/**
                                 
 _____ _____ _     _           _ 
|  __ |     |_|___| |_ ___ ___| |
| |___| | | | |  _|   | .'| -_| |
|_____|_|_|_|_|___|_|_|__,|___|_|
 *
 * @class SocketClient
 * @author Michael
 * @since May 5th, 2026
 * 
 * @description This module is responsible for the creation of Websocket clients.
 */

import crypto from 'crypto';
import { assert } from 'console';
import { EventEmitter } from 'events';

export class SocketClient extends EventEmitter {
    url; websocket;

    constructor(url) {
        super();
        this.url = url;
        this.websocket = new WebSocket(url || `wss://localhost:8080`);
        
        let {websocket} = this;
        websocket.onopen = ((event) => {
            this.emit(`connect`, event);
        });

        websocket.onmessage = ((event) => {
            let {data} = event;
            try {
                let message = JSON.parse(data);
                this.emit(`message`, message);
            } catch {
                this.emit(`message`, data);
            }
        });
        
        websocket.onclose = ((event) => {
            this.emit(`disconnect`, event);
        });

        websocket.onerror = ((event) => {
            this.emit(`error`, event);
        })
    }

    send(message) {
        if (typeof message === `object`) {
            this.websocket.send(JSON.stringify(message));
        } else {
            this.websocket.send(message);
        }
    }
}