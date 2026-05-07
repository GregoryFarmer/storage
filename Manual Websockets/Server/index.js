/**
                                 
 _____ _____ _     _           _ 
|  __ |     |_|___| |_ ___ ___| |
| |___| | | | |  _|   | .'| -_| |
|_____|_|_|_|_|___|_|_|__,|___|_|
 *
 * @author Michael
 * @since May 5th, 2026
 * 
 * @description Creates a new HTTPS server and connects a Websocket server to it.
 */

import https from 'node:https';
import { SocketServer } from './src/server.js';

const httpServer = https.createServer();
const websocketServer = new SocketServer(httpServer);

websocketServer.on(`ready`, () => {
    console.log(`The WebSocket server is ready!`);
});

websocketServer.on(`connect`, (socket) => {
    socket.on(`message`, (message) => {
        console.log(`Client says: ${message}`);
        SocketServer.sendText(socket, `The server has received your message, welcome aboard ${socket.id}!`);
    });
});

const a = httpServer.listen(8080).addListener(`listening`, function() {
    console.log(`Now listening to port ${a.address().port}`);
});
