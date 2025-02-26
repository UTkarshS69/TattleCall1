import express from "express"; 
import { createServer } from "http"; 
import { Server } from "socket.io"; 
import { fileURLToPath } from "url"; 
import { dirname, join } from "path";

const app = express();  
const server = createServer(app); 
const io = new Server(server); 
const allusers = {};

const __dirname = dirname(fileURLToPath(import.meta.url)); 

// Exposing public directory to outside world 
app.use(express.static("public"));

// Handle incoming HTTP request
app.get("/", (req, res) => {
    console.log("GET Request /"); 
    res.sendFile(join(__dirname, "app", "index.html"));
}); 

// Handle socket connections
io.on("connection", (socket) => {
    console.log(`User connected with socket ID: ${socket.id}`);

    socket.on("join-user", (username) => {
        console.log(`${username} joined with socket ID: ${socket.id}`); 
        allusers[username] = { username, id: socket.id }; 
        io.emit("joined", allusers);
    });

    socket.on("offer", ({ from, to, offer }) => {
        if (!allusers[to]) {
            console.error(`User ${to} not found in allusers`);
            return;
        }
        console.log(`Offer from ${from} to ${to}:`, offer);
        io.to(allusers[to].id).emit("offer", { from, to, offer });
    });

    socket.on("answer", ({ from, to, answer }) => {
        console.log(`Received answer from ${from} to ${to}`);

        if (!allusers[from]) {
            console.error(`User ${from} not found in allusers`);
            return;
        }
        io.to(allusers[from].id).emit("answer", { from, to, answer });
    });

    socket.on("end-call", ({ from, to }) => {
        if (!allusers[to]) {
            console.error(`User ${to} not found in allusers`);
            return;
        }
        io.to(allusers[to].id).emit("end-call", { from, to });
    });

    socket.on("call-ended", (caller) => {
        const [from, to] = caller;
        if (allusers[from] && allusers[to]) {
            io.to(allusers[from].id).emit("call-ended"); 
            io.to(allusers[to].id).emit("call-ended");
        } else {
            console.error(`One of the users (${from}, ${to}) not found in allusers`);
        }
    });

    socket.on("icecandidate", (candidate) => {
        console.log("Received ICE candidate:", candidate);
        socket.broadcast.emit("icecandidate", candidate);
    });

    socket.on("disconnect", () => {
        let disconnectedUser = null;
        Object.keys(allusers).forEach((user) => {
            if (allusers[user].id === socket.id) {
                disconnectedUser = user;
                delete allusers[user];
            }
        });

        if (disconnectedUser) {
            console.log(`User ${disconnectedUser} disconnected`);
            io.emit("user-disconnected", socket.id);
        }
    });
});

server.listen(9000, () => {
    console.log(`Server is listening on port 9000`);
});
