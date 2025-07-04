import mongoose from "mongoose";
import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";
import Message from "../models/messageModel.js";
import MessageReaction from "../models/messageReactionModel.js";
import { isValidObjectId, isValidUrl } from "./apiService.js";
import ConversationMember from "../models/conversationMemberModel.js";
import { decrypt, encrypt } from "../utils/utils.js";
import { secretKey } from "../static/constant.js";
import { io } from "../index.js";
import { formatUserData } from "./userService.js";
import Notification from "../models/notificationModel.js";

const formatMessageData = async (message, currentUser) => {
  const userKey = currentUser.secretKey;
  const decryptedContent = decrypt(message.content, secretKey);
  const encryptedContent = encrypt(decryptedContent, userKey);
  const reactions = await MessageReaction.find({ message: message._id });
  message.isOwner = message.user._id.equals(currentUser._id) ? 1 : 0;
  message.isUpdated =
    message.updatedAt.getTime() !== message.createdAt.getTime() ? 1 : 0;
  message.isReacted = (await MessageReaction.exists({
    user: currentUser._id,
    message: message._id,
  }))
    ? 1
    : 0;
  message.isChildren = message.parent ? 1 : 0;
  message.totalReactions = reactions.length;

  return {
    _id: message._id,
    conversation: {
      _id: message.conversation,
    },
    user: {
      _id: message.user._id,
      displayName: message.user.displayName,
      avatarUrl: message.user.avatarUrl,
    },
    content: encryptedContent,
    imageUrl: message.imageUrl,
    createdAt: formatDistanceToNowStrict(message.createdAt, {
      addSuffix: true,
      locale: vi,
    }),
    isOwner: message.isOwner,
    isUpdated: message.isUpdated,
    isReacted: message.isReacted,
    isChildren: message.isChildren,
    ...(message.isChildren === 1 &&
      message.parent && {
        parent: {
          _id: message.parent._id,
          user: {
            _id: message.parent.user._id,
            displayName: message.parent.user.displayName,
            avatarUrl: message.parent.user.avatarUrl,
          },
        },
      }),
    totalReactions: message.totalReactions,
  };
};

const getListMessages = async (req) => {
  const {
    content,
    parent,
    isPaged,
    conversation,
    page = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;
  const currentUser = req.user;

  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);

  let query = {};
  if (isValidObjectId(parent)) {
    query.parent = new mongoose.Types.ObjectId(parent);
  }
  if (isValidObjectId(conversation)) {
    query.conversation = new mongoose.Types.ObjectId(conversation);
    const [lastMessage, conversationMembers] = await Promise.all([
      Message.findOne({ conversation }).sort({ createdAt: -1 }),
      ConversationMember.find({ conversation }).select("user"),
    ]);
    if (
      lastMessage &&
      conversationMembers.some((member) => member.user.equals(currentUser._id))
    ) {
      await ConversationMember.findOneAndUpdate(
        {
          conversation,
          user: currentUser._id,
        },
        {
          lastReadMessage: lastMessage._id,
        }
      );
    }
  }

  const messages = await Message.find(query)
    .populate("user parent")
    .sort({ createdAt: -1 });

  let filteredMessages = messages;
  if (content) {
    filteredMessages = messages.filter((message) => {
      const decryptedContent = decrypt(message.content, secretKey);
      return decryptedContent.toLowerCase().includes(content.toLowerCase());
    });
  }
  const pagedMessages = filteredMessages.slice(offset, offset + limit);

  io.to(currentUser._id.toString()).emit(
    "NEW_NOTIFICATION",
    await formatUserData(currentUser)
  );

  const totalPages = Math.ceil(filteredMessages.length / limit);
  const result = await Promise.all(
    pagedMessages.map(async (message) => {
      return await formatMessageData(message, currentUser);
    })
  );

  return {
    content: result,
    totalPages,
    totalElements: filteredMessages.length,
  };
};

const createMessage = async (
  currentUser,
  getConversation,
  parentMessage,
  content,
  imageUrl
) => {
  const decryptedContent = decrypt(content, currentUser.secretKey);
  console.log(decryptedContent);
  const message = await Message.create({
    conversation: getConversation._id,
    user: currentUser._id,
    content: encrypt(decryptedContent, secretKey),
    imageUrl: isValidUrl(imageUrl) ? imageUrl : null,
    parent: parentMessage ? parentMessage._id : null,
  });
  await getConversation.updateOne({
    lastMessage: message._id,
  });
  await ConversationMember.findOneAndUpdate(
    {
      conversation: getConversation._id,
      user: currentUser._id,
    },
    { lastReadMessage: message._id }
  );
  io.to(getConversation._id.toString()).emit("CREATE_MESSAGE", message._id);
  console.log("CREATE_MESSAGE event emitted (socket):", message._id);

  // Lấy tất cả thành viên trong cuộc trò chuyện (trừ người gửi)
  const conversationMembers = await ConversationMember.find({
    conversation: getConversation._id,
    user: { $ne: currentUser._id },
  }).populate({
    path: "user",
    populate: {
      path: "role",
    },
  });

  // Tạo thông báo cho tất cả thành viên khác
  if (conversationMembers.length > 0) {
    await Notification.create(
      conversationMembers.map((member) => ({
        user: member.user._id,
        data: {
          conversation: {
            _id: getConversation._id,
          },
          message: {
            _id: message._id,
          },
          user: {
            _id: currentUser._id,
          },
        },
        message: `${currentUser.displayName} đã gửi tin nhắn mới`,
      }))
    );
  }

  // Gửi thông báo real-time cho tất cả thành viên
  const allMembers = await ConversationMember.find({
    conversation: getConversation._id,
  }).populate({
    path: "user",
    populate: {
      path: "role",
    },
  });

  await Promise.all(
    allMembers.map(async (member) => {
      const formattedUserData = await formatUserData(member.user);
      io.to(member.user._id.toString()).emit(
        "NEW_NOTIFICATION",
        formattedUserData
      );
    })
  );
};

export { formatMessageData, getListMessages, createMessage };
