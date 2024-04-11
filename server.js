const express = require("express");
const path = require("path");
var app = express();
var userConnections = [];

var server = app.listen(3000,function(){
    console.log("Listening on port 3000")
});

const io = require("socket.io")(server);
app.use(express.static(path.join(__dirname,"")));

io.on("connection",(socket)=>{
    
    console.log("Socket id is ",socket.id);

    socket.on("userconnect", (data)=>{
        console.log("userconnect",data.displayName,data.meeting_ID);

        var otherUsers = userConnections.filter(
            (p)=>p.meetingID == data.meeting_ID
        );

        userConnections.push({
            connectionID : socket.id,
            userID:data.displayName,
            meetingID:data.meeting_ID,
        });

        otherUsers.forEach((v)=>{
            socket.to(v.connectionID).emit("informOthersAboutMe",{
                otherUserID:data.displayName,
                connID:socket.id,
            });
        });

        socket.emit("informMeAboutOtherUsers",otherUsers);

    });

    socket.on("SDPProcess",(data)=>{
        socket.to(data.to_connID).emit("SDPProcess",{
            message:data.message,
            from_connID:socket.id,
        })
    })

    socket.on("disconnect", function() {
        console.log("Disconnected");
        var disUser = userConnections.find((p) => p.connectionID == socket.id);
        if(disUser){
            var meetingID = disUser.meetingID;
            userConnections = userConnections.filter((p)=>p.connectionID!=socket.id);
            var list = userConnections.filter((p)=>p.meetingID == meetingID);
            list.forEach((v)=>{
                socket.to(v.connectionID).emit("informAboutDisconnectedUser",{
                    connID:socket.id,
                })
            });
        }
    });
    

});