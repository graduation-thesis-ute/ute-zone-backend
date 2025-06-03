import CryptoJS from "crypto-js";
import "dotenv/config.js";

const encrypt = (value, secretKey) => {
  return CryptoJS.AES.encrypt(value, secretKey).toString();
};

const decrypt = (encryptedValue, secretKey) => {
  const decrypted = CryptoJS.AES.decrypt(encryptedValue, secretKey);
  return decrypted.toString(CryptoJS.enc.Utf8);
};

const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Room handling
    socket.on("JOIN_CONVERSATION", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("LEAVE_CONVERSATION", (conversationId) => {
      socket.leave(conversationId);
    });

    socket.on("JOIN_USER", (userId) => {
      socket.join(userId);
    });

    socket.on("LEAVE_USER", (userId) => {
      socket.leave(userId);
    });

    socket.on("JOIN_NOTIFICATION", (userId) => {
      socket.join(userId);
    });

    socket.on("LEAVE_NOTIFICATION", (userId) => {
      socket.leave(userId);
    });

    // Video Call - Start
    socket.on(
      "START_VIDEO_CALL",
      ({ conversationId, callerId, callerName, callerAvatar, receiverId }) => {
        console.log("START_VIDEO_CALL event received (socket):", {
          conversationId,
          callerId,
          callerName,
          callerAvatar,
          receiverId,
        });

        io.to(receiverId).emit("INCOMING_VIDEO_CALL", {
          callerId,
          callerName,
          callerAvatar,
          conversationId,
        });
      }
    );

    // Video Call - Accept
    socket.on(
      "ACCEPT_VIDEO_CALL",
      ({
        callerId,
        receiverId,
        receiverName,
        receiverAvatar,
        conversationId,
      }) => {
        console.log("ACCEPT_VIDEO_CALL event received (socket):", {
          callerId,
          receiverId,
          receiverName,
          receiverAvatar,
          conversationId,
        });

        io.to(callerId).emit("VIDEO_CALL_ACCEPTED", {
          receiverId,
          receiverName,
          receiverAvatar,
          conversationId,
        });
      }
    );

    // Video Call - Reject
    socket.on(
      "REJECT_VIDEO_CALL",
      ({ callerId, receiverId, conversationId }) => {
        console.log("REJECT_VIDEO_CALL event received (socket):", {
          callerId,
          receiverId,
          conversationId,
        });

        io.to(callerId).emit("VIDEO_CALL_REJECTED", {
          receiverId,
          conversationId,
        });

        io.to(receiverId).emit("VIDEO_CALL_REJECTED", {
          callerId,
          conversationId,
        });

        io.to(conversationId).emit("CALL_ENDED", {
          message: "Cuộc gọi bị nhỡ",
          senderId: callerId,
          receiverId,
        });
      }
    );

    // WebRTC Signaling
    socket.on("OFFER", (data) => {
      console.log("OFFER event received (socket):", data);
      io.to(data.to).emit("OFFER", data);
    });

    socket.on("ANSWER", (data) => {
      console.log("ANSWER event received (socket):", data);
      io.to(data.to).emit("ANSWER", data);
    });

    socket.on("ICE_CANDIDATE", (data) => {
      console.log("ICE_CANDIDATE event received (socket):", data);
      io.to(data.to).emit("ICE_CANDIDATE", data);
    });

    // Video Call - Caller cancels
    socket.on("END_CALL_WHILE_CALLING_FROM_CALLER", ({ receiverId }) => {
      io.to(receiverId).emit("END_CALL_WHILE_CALLING_BY_CALLER");
      console.log("Video call ended by the caller in socket.");
    });

    // Video Call - Receiver cancels
    socket.on("END_CALL_WHILE_CALLING_FROM_RECEIVER", ({ callerId }) => {
      io.to(callerId).emit("END_CALL_WHILE_CALLING_BY_RECEIVER");
    });

    // Video Call - End
    socket.on("END_VIDEO_CALL_FROM_CALLER", ({ receiverId }) => {
      io.to(receiverId).emit("END_VIDEO_CALL_BY_CALLER");
      console.log("Video call ended by the caller in socket.");
    });

    socket.on("END_VIDEO_CALL_FROM_RECEIVER", ({ callerId }) => {
      io.to(callerId).emit("END_VIDEO_CALL_BY_RECEIVER");
      console.log("Video call ended by the receiver in socket.");
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
    });
  });
};

const calculateAverageDailyCount = async (model, dateField) => {
  const results = await model.aggregate([
    {
      $match: {
        [dateField]: { $ne: null },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` },
        },
        dailyCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        averageDailyCount: { $avg: "$dailyCount" },
      },
    },
    {
      $project: {
        _id: 0,
        averageDailyCount: 1,
      },
    },
  ]);
  return results[0]?.averageDailyCount
    ? +results[0].averageDailyCount.toFixed(2)
    : 0;
};

export { encrypt, decrypt, setupSocketHandlers, calculateAverageDailyCount };
