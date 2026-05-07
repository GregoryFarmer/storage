/**
                                 
 _____ _____ _     _           _ 
|  __ |     |_|___| |_ ___ ___| |
| |___| | | | |  _|   | .'| -_| |
|_____|_|_|_|_|___|_|_|__,|___|_|
 *
 * @class SocketServer
 * @author Michael
 * @since May 5th, 2026
 * 
 * @description This module is for the construction of Websocket servers compatible with Node.js' http/https modules. 
 */

import crypto from 'crypto';
import { assert } from 'console';
import { EventEmitter } from 'events';

import {sendFrame, parseFrame} from './util/frameUtil.js';
import {generateSecureHex} from './util/hexHelper.js';


export class SocketServer extends EventEmitter {
    static websockets = new Map();

    constructor(httpServer) {
        super();
        
        httpServer.on(`upgrade`, (req, socket) => {
            const id = generateSecureHex(8);
            socket.id = id;
            SocketServer.websockets.set(id, socket);

            this.emit(`connect`, socket)

            if (req.headers[`upgrade`] !== `websocket`) {
                socket.end(`HTTP/1.1 400 Bad Request`);
                return;
            }

            const key = req.headers[`sec-websocket-key`];
            const GUID = `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`;
            const acceptKey = crypto.createHash(`sha1`).update(key + GUID).digest(`base64`);

            let buffer = Buffer.alloc(0);
            let fragmentedMessage = null;

            socket.write(
                `HTTP/1.1 101 Switching Protocols\r\n` +
                `Upgrade: websocket\r\n` +
                `Connection: Upgrade\r\n` +
                `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
            );

            socket.on(`error`, (err) => {
                console.log(`Socket ${socket.id} error:`, err.message);
                let websockets = SocketServer.websockets;
                if (SocketServer.websockets.has(socket.id)) {
                    SocketServer.websockets.delete(socket.id);
                }
            });

            socket.on(`close`, () => {
                console.log(`Socket ${socket.id} disconnected`);
                let websockets = SocketServer.websockets;
                if (SocketServer.websockets.has(socket.id)) {
                    SocketServer.websockets.delete(socket.id);
                }
            })                

            socket.on(`data`, (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);

                while (true) {
                    const frame = parseFrame(buffer);
                    if (!frame) break;

                    buffer = buffer.slice(frame.frameLength);
                    handleFrame(frame, socket);
                }
            });

            const globalMessage = (socket, message) => {
                SocketServer.broadcast(message);
            };

            const onMessage = (socket, message) => {
                socket.emit(`message`, message)
            };

            const handleFrame = (frame, socket) => {
                const { opcode, payload, fin } = frame;
                switch (opcode) {
                    case 0x0:
                        fragmentedMessage = Buffer.concat([fragmentedMessage, payload]);
                        if (fin) {
                            onMessage(socket, fragmentedMessage.toString());
                            fragmentedMessage = null;
                        }
                        break;
                    case 0x1:
                        if (!fin) {
                            fragmentedMessage = payload;
                        } else {
                            onMessage(socket, payload.toString());
                        }
                        break;
                    case 0x8:
                        SocketServer.sendClose(socket);
                        socket.end();
                        break;
                    case 0x9:
                        SocketServer.sendPong(socket);
                        socket.end();
                        break;
                    default:
                        break;
                }
            };
        });

        process.nextTick(() => {
            this.emit(`ready`, httpServer);
        })
    }

    static broadcast(message) {
        const payload = Buffer.from(message);

        let websockets = SocketServer.websockets;
        for (const data of Array.from(websockets, ([key, value]) => ({ key, value }))) {
            try {
                sendFrame(data.value, 0x1, payload);
            } catch (err) {
                console.error(`Failed to send to a client: ${err}`);
            }
        }
    }

    static sendText(socket, text) {
        return sendFrame(socket, 0x1, Buffer.from(text));
    }

    static sendPong(socket, text = "") {
        return sendFrame(socket, 0xA, Buffer.from(text));
    }

    static sendClose(socket) {
        return sendFrame(socket, 0x8);
    }
}