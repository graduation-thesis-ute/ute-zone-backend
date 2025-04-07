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

    // Các sự kiện hiện có
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

    // Các sự kiện mới cho Video Call
    socket.on(
      "START_VIDEO_CALL",
      ({ conversationId, callerId, receiverId }) => {
        console.log("START_VIDEO_CALL event received:", {
          conversationId,
          callerId,
          receiverId,
        });
        // Gửi thông báo cuộc gọi đến người nhận - sử dụng userId thay vì conversationId
        // để đảm bảo người nhận nhận được thông báo ngay cả khi không ở trong conversation
        io.to(receiverId).emit("INCOMING_VIDEO_CALL", {
          callerId,
          conversationId,
        });
      }
    );

    socket.on(
      "ACCEPT_VIDEO_CALL",
      ({ callerId, receiverId, conversationId }) => {
        // Thông báo người gọi rằng cuộc gọi được chấp nhận
        io.to(callerId).emit("VIDEO_CALL_ACCEPTED", {
          receiverId,
          conversationId,
        });
      }
    );

    socket.on(
      "REJECT_VIDEO_CALL",
      ({ callerId, receiverId, conversationId }) => {
        console.log("REJECT_VIDEO_CALL event received:", {
          callerId,
          receiverId,
          conversationId,
        });

        // Notify the caller that the call was rejected
        io.to(callerId).emit("VIDEO_CALL_REJECTED", {
          receiverId,
          conversationId,
        });

        // Also notify the receiver (callee) that the call was rejected
        // This ensures the callee's popup is dismissed if they haven't already dismissed it
        io.to(receiverId).emit("VIDEO_CALL_REJECTED", {
          callerId,
          conversationId,
        });

        // Send notification to save "Missed call" message
        io.to(conversationId).emit("CALL_ENDED", {
          message: "Missed call",
          senderId: callerId,
          receiverId,
        });
      }
    );

    socket.on("OFFER", (data) => {
      // Gửi SDP offer từ caller đến receiver
      io.to(data.to).emit("OFFER", data);
    });

    socket.on("ANSWER", (data) => {
      // Gửi SDP answer từ receiver đến caller
      io.to(data.to).emit("ANSWER", data);
    });

    socket.on("ICE_CANDIDATE", (data) => {
      // Trao đổi ICE candidates giữa hai bên
      io.to(data.to).emit("ICE_CANDIDATE", data);
    });

    socket.on("END_VIDEO_CALL", ({ conversationId, callerId, receiverId }) => {
      // Thông báo cuộc gọi kết thúc
      io.to(receiverId).emit("VIDEO_CALL_ENDED", { callerId });
      io.to(callerId).emit("VIDEO_CALL_ENDED", { receiverId });
      // Gửi thông báo để lưu tin nhắn "Video call ended"
      io.to(conversationId).emit("CALL_ENDED", {
        message: "Video call ended",
        senderId: callerId,
        receiverId,
      });
    });

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
