var AppProcess= ( function() {

    var peers_connection_ids = [];
    var peers_connection = [];
    var remoteVidStream = [];
    var remoteAudStream = [];
    var serverProcess;
    var localDiv;
    var audio;
    var isAudioMute = true;
    var rtpAudSenders=[];
    var videoStates = {
        None:0,
        Camera:1,
        ScreenShare:2
    }
    var video_st = videoStates.None;
    var videoCamTrack;
    var rtpVidSenders = [];

    async function _init(SDP_function,my_connID){
        serverProcess = SDP_function ;
        my_connectionID = my_connID;
        eventProcess();
        localDiv = document.getElementById("localVideoPlayer");
    }

    function eventProcess(){
        $("#micMuteUnmute").on("click",async function(){
            if(!audio){
                await loadAudio();
            }
            if(!audio){
                alert("Audio permission not granted");
                return;
            }
            if(isAudioMute){
                audio.enabled = true;
                $(this).html("<span class='material-symbols-outlined'>mic</span>");
                updateMediaSenders(audio,rtpAudSenders);
            }else{
                audio.enabled=false;
                $(this).html("<span class='material-symbols-outlined'>mic_off</span>");
                removeMediaSenders(rtpAudSenders);
            }
            isAudioMute = !isAudioMute;
        })

        $("#videoCamOnfOff").on("click",async function(){
            if(video_st == videoStates.Camera){
                await videoProcess(videoStates.None);
            }else{
                await videoProcess(videoStates.Camera);
            }
            
        })
        $("#screenShareOnOff").on("click",async function(){
            if(video_st == videoStates.ScreenShare){
                await videoProcess(videoStates.None);
            }else{
                await videoProcess(videoStates.ScreenShare);
            }
        })
    }
    async function loadAudio(){
        try {
            var astream = await navigator.mediaDevices.getUserMedia({
                video:false,
                audio:true
            });
            audio = astream.getAudioTracks()[0];
            audio.enabled = false;
          
        } catch (error) {
            console.log(error);
        }
    }
    function connectionStatus(connection){
        if(connection && ( connection.connectionState == "new" || connection.connectionState == "connecting" || connection.connectionState == "connected" )) {
            return true;
        }else{
            return false;
        }
    }

    async function updateMediaSenders(track, rtpSenders){
        for(var conn_ID in peers_connection_ids){
            if(connectionStatus(peers_connection[conn_ID])){
                if(rtpSenders[conn_ID] && rtpSenders[conn_ID].track){
                    rtpSenders[conn_ID].replaceTrack(track);
                }else{
                    rtpSenders[conn_ID] = peers_connection[conn_ID].addTrack(track);
                }
            }
        }
    }

    function removeMediaSenders(rtpSenders){
        for(var connID in peers_connection_ids){
            if(rtpSenders[connID] && connectionStatus(peers_connection[connID])){
                peers_connection[connID].removeTrack(rtpSenders[connID]);
                rtpSenders[connID] = null;
            }
        }
    }
    function remoteVideoStream(rtpVidSenders){
        if(videoCamTrack){
            videoCamTrack.stop();
            videoCamTrack = null;
            localDiv.srcObject=null;
            removeMediaSenders(rtpVidSenders);
        }
    }

    async function videoProcess(newVideoState){
        if(newVideoState == videoStates.None){
            $("#videoCamOnfOff").html("<span class='material-symbols-outlined'>videocam_off</span>"); 
            video_st=newVideoState;
            remoteVideoStream(rtpVidSenders);

            return;
        }
        if(newVideoState == videoStates.Camera){
            $("#videoCamOnfOff").html("<span class='material-symbols-outlined'>videocam</span>");
        }
        try {
            var vstream =null;
            if(newVideoState == videoStates.Camera){
                vstream = await navigator.mediaDevices.getUserMedia({
                    video:{
                        width:1920,
                        height:1080
                    },
                    audio:false
                })
            }else if(newVideoState == videoStates.ScreenShare){
                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video:{
                        width:1920,
                        height:1080
                    },
                    audio:false
                });
                vstream.oninactive = (e)=>{
                    remoteVideoStream(rtpVidSenders);
                    $("#screenShareOnOff").html('<span class="material-symbols-outlined ">present_to_all</span><div >Present Now</div>');
                }
            }
            if(vstream && vstream.getVideoTracks().length>0){
                videoCamTrack = vstream.getVideoTracks()[0];
                if(videoCamTrack){
                    localDiv.srcObject = new MediaStream([videoCamTrack]);
                    updateMediaSenders(videoCamTrack,rtpVidSenders);
                }
            }
        } catch(e){
           console.log(e);
           return;
        }
        video_st = newVideoState;
        if(newVideoState == videoStates.Camera){
            $("#videoCamOnfOff").html("<span class='material-symbols-outlined'>videocam</span>");
            $("#screenShareOnOff").html('<span class="material-symbols-outlined ">present_to_all</span><div >Present Now</div>');
        }else if(newVideoState == videoStates.ScreenShare){
            $("#screenShareOnOff").html('<span class="material-symbols-outlined text-success">present_to_all</span><div class="text-success">Stop Presenting</div>');
            $("#videoCamOnfOff").html("<span class='material-symbols-outlined'>videocam_off</span>");
        }
    }

     var iceConfiguration = {
        iceServers:[
            {
                urls:"stun:stun.l.google.com:19302",
            },
            {
                urls:"stun:stun1.l.google.com:19302",
            },    
        ],
     }

      async function setConnection(connID){

          var connection = new RTCPeerConnection(iceConfiguration);

          connection.onnegotiationneeded = async function(event) {
            await setOffer(connID);
          };

          connection.onicecandidate = function(event){
            if(event.candidate){
                serverProcess(JSON.stringify({icecandidate : event.candidate}),connID);
            }
          };

          connection.ontrack = function(event) {
            
        
            if (!remoteVidStream[connID]) {
                remoteVidStream[connID] = new MediaStream();
            }
            if (!remoteAudStream[connID]) {
                remoteAudStream[connID] = new MediaStream();
            }
        
            if (event.track.kind == "video") {
                remoteVidStream[connID].getVideoTracks().forEach((t) => remoteVidStream[connID].removeTrack(t));
                remoteVidStream[connID].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_" + connID);
                
                    remoteVideoPlayer.srcObject = null;
                    remoteVideoPlayer.srcObject = remoteVidStream[connID];
                    remoteVideoPlayer.load();
                
        
            } else if (event.track.kind == "audio") {
                remoteAudStream[connID].getAudioTracks().forEach((t) => remoteAudStream[connID].removeTrack(t));
                remoteAudStream[connID].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_" + connID);
                
                    remoteAudioPlayer.srcObject = null;
                    remoteAudioPlayer.srcObject = remoteAudStream[connID];
                    remoteAudioPlayer.load();
                
            }
        };
        

          peers_connection_ids[connID] = connID;
          peers_connection[connID] = connection;
          
          if(video_st == videoStates.Camera || video_st == videoStates.ScreenShare){      
            if(videoCamTrack){
                updateMediaSenders(videoCamTrack,rtpVidSenders);
              } 
           }

          return connection;


      }

      async function setOffer(connID){
          var connection = peers_connection[connID];
          var offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          serverProcess(JSON.stringify({
            offer:connection.localDescription,
          }),connID);
      }

      async function SDPProcess(message,from_connID){
        message =JSON.parse(message);
        if(message.answer){
            await peers_connection[from_connID].setRemoteDescription(new RTCSessionDescription(message.answer));

        }else if(message.offer){
            if(!peers_connection[from_connID]){
                await setConnection(from_connID);
            }
            await peers_connection[from_connID].setRemoteDescription(new RTCSessionDescription(message.offer));
            var answer = await peers_connection[from_connID].createAnswer();
            await peers_connection[from_connID].setLocalDescription(answer);
            serverProcess(JSON.stringify({
                answer:answer,
              }),from_connID);
        }else if(message.icecandidate){
            if(!peers_connection[from_connID]){
                await setConnection(from_connID);
            }
            try{
                await peers_connection[from_connID].addIceCandidate(message.icecandidate);
            }catch(e){
                console.log(e);
            }
        }
      }
      async function closeConnection(connID){
           peers_connection_ids[connID]= null;
           if(peers_connection[connID]){
            peers_connection[connID].close();
            peers_connection[connID]=null;
           }
           if(remoteAudStream[connID]){
            remoteAudStream[connID].getTrack().forEach((t)=>{
                if(t.stop) t.stop();
            })
            remoteAudStream[connID] =null;
           }
           if(remoteVidStream[connID]){
            remoteVidStream[connID].getTrack().forEach((t)=>{
                if(t.stop) t.stop();
            })
            remoteVIdStream[connID] =null;
           }
      }

      return {
        setNewConnection: async function(connID){
             await setConnection(connID);
        },
        init: async function(SDP_function,my_connID){
            await _init(SDP_function,my_connID);
        },
        processClientFunc : async function(data,from_connID){
            await SDPProcess(data,from_connID);
        },
        closeCall : async function(connID){
            await closeConnection(connID);
        },
      };
})();

var MyApp= (function() {

    var socket = null; 
    var userID="";
    var meetingID="";

    function init(uid,mid){
        userID=uid;
        meetingID=mid;
        $("#meetingContainer").show();
        $("#me h2").text(userID+"(Me)");
        document.title = userID;
        eventProcessForSignalingServer();
    } 

    function eventProcessForSignalingServer(){

        socket = io.connect();

        var SDP_function = function(data,to_connID){
            socket.emit("SDPProcess",{
                message:data,
                to_connID:to_connID
            })
        }

        socket.on("connect",()=>{

            if(socket.connected){
                AppProcess.init(SDP_function,socket.id);
                if(userID!="" && meetingID!=""){
                    socket.emit("userconnect",{
                        displayName:userID,
                        meeting_ID:meetingID
                    })
                }
            }
        });

        socket.on("informOthersAboutMe",function(data){
            addUser(data.otherUserID,data.connID);
            AppProcess.setNewConnection(data.connID);
        });
        
        socket.on("informAboutDisconnectedUser",function(data){
          $("#"+data.connID).remove();
          AppProcess.closeCall(data);
        });

        socket.on("informMeAboutOtherUsers",function(otherUsers){
            
            if(otherUsers){
                for(var i=0;i<otherUsers.length;i++){
                    addUser(otherUsers[i].userID,otherUsers[i].connectionID);
                    AppProcess.setNewConnection(otherUsers[i].connectionID);
                }
            }       
        });
 
        socket.on("SDPProcess",async function (data) {
            await AppProcess.processClientFunc(data.message,data.from_connID);
        });

    }
   

    function addUser(otherUserID, connID) {
        var newDivID = $("#otherTemplate").clone();
        newDivID = newDivID.attr("id", connID).addClass("other");
        newDivID.find("h2").text(otherUserID);
        newDivID.find("video").attr("id", "v_" + connID); // Corrected syntax
        newDivID.find("audio").attr("id", "a_" + connID); // Corrected syntax
        newDivID.show();
        $("#divUsers").append(newDivID);
    }
    

    return {
        _init : function(uid,mid){
            init(uid,mid);
        },
    };
})();