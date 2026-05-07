/**
                                 
 _____ _____ _     _           _ 
|  __ |     |_|___| |_ ___ ___| |
| |___| | | | |  _|   | .'| -_| |
|_____|_|_|_|_|___|_|_|__,|___|_|
 *
 * @author Michael
 * @since May 5th, 2026
 * 
 * @description Creates a new Websocket client and sends data to the server.
 */

import {SocketClient} from './client.js';
let client = new SocketClient(`wss://localhost:8080`);
client.on(`connect`, function() {
    console.log(`The socket has successfully connected! 🎉`)
    client.send(`Hello, server! 👋`)
})

client.on(`disconnect`, function() {
    console.log(`The server has been closed! 😔`)
})


client.on(`error`, function(event) {
    console.log(`An error has occurred!`, event)
})

client.on(`message`, function(message) { 
    console.log(message)
})