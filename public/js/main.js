const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const socket = io();
const usernameContainer = document.querySelector(".username-input");
const allusersHTML = document.getElementById("allusers");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo"); 
const endcallBtn = document.getElementById("end-call-btn"); 
let localStream;
let currentCaller; 
let caller = [];

// Singleton for PeerConnection
const PeerConnection = (function(){
    let peerConnection;

    const createPeerConnection = () => {
        const config = {
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com:19302'
                }
            ]
        };
        peerConnection = new RTCPeerConnection(config);

        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Listen to remote stream and add to video element
        peerConnection.ontrack = function(event) {
            remoteVideo.srcObject = event.streams[0];
        }

        // Listen for ice candidate
        peerConnection.onicecandidate = function(event) {
            if(event.candidate){
                socket.emit("icecandidate", event.candidate);
            }
        }

        return peerConnection;
    }

    return {
        getInstance: () => {
            if(!peerConnection){
                peerConnection = createPeerConnection();
            }
            return peerConnection;
        }
    }
})();

// Handle click event for button
createUserBtn.addEventListener("click", () => {
    if (username.value !== "") {
        socket.emit("join-user", username.value);
        usernameContainer.style.display = 'none';
    }
});

// Handle Enter key event for input
username.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && username.value !== "") {
        socket.emit("join-user", username.value);
        usernameContainer.style.display = 'none';
    }
}); 

endcallBtn.addEventListener("click", (e) => {
    socket.emit("call-ended", caller)
});

// Handle socket events:
socket.on("joined", allusers => {
    console.log({allusers});
    const createUserHtml = () => {
        allusersHTML.innerHTML = "";

        for(const user in allusers){
            const li = document.createElement("li");
            li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

            if(user !== username.value) {
                const button = document.createElement("button");
                button.classList.add("call-btn");
                button.addEventListener("click", (e) => {
                    startCall(user);
                });
                const img = document.createElement("img");
                img.setAttribute("src", "/images/phone.png");
                img.setAttribute("width", 20);

                button.appendChild(img);
                li.appendChild(button);
            }

            allusersHTML.appendChild(li);
        }
    }
    createUserHtml();
}); 
socket.on("offer", async ({from, to, offer}) => { 
    const pc = PeerConnection.getInstance(); 
    // set remote description: 
    await pc.setRemoteDescription(offer); 
    const answer = await pc.createAnswer(); 
    await pc.setLocalDescription(answer); 
    socket.emit("answer", {from, to, answer: pc.localDescription}); 
    caller = [from,to];
}); 
socket.on("answer",async ({from, to, answer}) => {
    const pc = PeerConnection.getInstance(); 
    await pc.setRemoteDescription(answer); 
    // Show end call button: 
    endcallBtn.style.display = 'block';
    socket.emit("end-call", {from, to}); 
    caller = [from, to];
}); 

socket.on("icecandidate",async candidate => { 
    console.log({candidate}); 
    const pc = PeerConnection.getInstance(); 
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
}); 

socket.on("end-call", ({from, to}) => {
    endcallBtn.style.display = "block";
}); 

socket.on("call-ended", (caller) => {
    endCall();
});

// Start call Method
const startCall = async(user) => {
    console.log({user});
    currentCaller = user;
    const pc = PeerConnection.getInstance();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", {from: username.value, to: user, offer: pc.localDescription});
} 

// End Call Method: 
const endCall = () => {
    const pc = PeerConnection.getInstance(); 
    if(pc) {
        pc.close(); 
        endcallBtn.style.display = 'none';
    }
}

// Handle incoming offer
socket.on("offer", async(data) => {
    currentCaller = data.from;
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", {to: data.from, answer: pc.localDescription});
});

// Handle incoming answer
socket.on("answer", async(data) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

// Handle incoming ICE candidates
socket.on("ice-candidate", async(data) => {
    const pc = PeerConnection.getInstance();
    if(data.candidate){
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// Initialize app
const startMyVideo = async() => {
    try{
        const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
        localStream = stream;
        localVideo.srcObject = stream;
    } catch(error) {
        console.error("Error accessing media devices.", error);
    }
}

startMyVideo();
