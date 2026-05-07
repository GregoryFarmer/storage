import { assert } from 'console';

export function parseFrame(buffer) {
    if (buffer.length < 2 || !buffer) return null;
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;

    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;

    let offset = 2;
    if (payloadLength === 126) {
        if (buffer.length < offset + 2) return null;
        payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
    } else if (payloadLength === 127) {
        if (buffer.length < offset + 8) return null;
        const high = buffer.readUInt32BE(offset);
        const low = buffer.readUInt32BE(offset + 4);
        payloadLength = high * 2 ** 32 + low;
        offset += 8;
    }

    const maskOffset = offset;
    if (masked) {
        if (buffer.length < offset + 4) return null;
        offset += 4;
    }

    if (buffer.length < offset + payloadLength) return null;
    let payload = buffer.slice(offset, offset + payloadLength);

    if (masked) {
        const mask = buffer.slice(maskOffset, maskOffset + 4);
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
        }
    }

    return {
        fin, opcode, payload, frameLength: offset + payloadLength
    };
}

export function sendFrame(socket, opcode, payload = Buffer.alloc(0)) {
    assert(socket, `The socket does not exist!`);
    const fin = 0x80; const header = [fin | opcode];
    const length = payload.length;

    if (length < 126) {
        header.push(length);
    } else if (length < 65536) {
        header.push(126, (length >> 8) & 255, length & 255);
    } else {
        header.push(127, 0, 0, 0, 0, (length >> 24) & 255, (length >> 16) & 255, (length >> 8) & 255, length & 255);
    }
    socket.write(Buffer.concat([Buffer.from(header), payload]));
}