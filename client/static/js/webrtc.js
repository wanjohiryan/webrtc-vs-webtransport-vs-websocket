import {chart, initCanvas, visualizePacket} from "./common.js";

const webRTCBtn = document.getElementById("webrtc");

webRTCBtn.onclick = (_) => {
    initCanvas();
    // webRTCBtn.disabled = true;

    let t0 = new Date();
    let messageCount = 0;
    let iceFinished = false;

    const wsClient = new WebSocket("wss://localhost:8002");
    const conn = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
    const dataChannel = conn.createDataChannel('dataChannel', {ordered: true, maxRetransmits: 5,});
    const decoder = new TextDecoder("utf-8");

    conn.onicecandidate = async e => {
        // console.log(`New ice candidate: ${e.candidate}`)
        if (e.candidate === null) {
            iceFinished = true;
            while (wsClient.readyState !== 1) await new Promise(r => setTimeout(r, 10));
            wsClient.send(btoa(JSON.stringify(conn.localDescription)));
        }
    }

    dataChannel.onopen = () => {
        console.info(`WebRTC DataChannel established in ${new Date() - t0} ms.`);
        t0 = new Date();
        chart.data.datasets[2].data.push({x: 0, y: 0});
    };

    dataChannel.onmessage = (e) => {
        messageCount += 1;
        if (new Date() - t0 - chart.data.datasets[2].data.at(-1).x > 200) {
            chart.data.datasets[2].data.push({x: new Date() - t0, y: messageCount});
            chart.update();
        }
        visualizePacket(decoder.decode(e.data));
    }

    dataChannel.onclose = () => {
        chart.data.datasets[2].data.push({x: new Date() - t0, y: messageCount});
        chart.update();
        conn.close();
        console.info(`${messageCount} message(s) were received within ${new Date() - t0} ms.`)
        console.info('DataChannel closed');
    };

    conn.createOffer().then(o => conn.setLocalDescription(o));

    wsClient.onmessage = (e) => {
        try {
            conn.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(e.data)))).then();
        } catch (e) {
            console.error(e);
        }
    }
}
