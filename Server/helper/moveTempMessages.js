// 📁 helpers/moveTempMessages.js
import TemporaryChat from "../models/TemporaryChat.js";
import Message from "../models/Message.js";

export async function moveTempMessagesToConversation(tempChatId, matchId) {
  const tempChat = await TemporaryChat.findById(tempChatId);
  if (!tempChat || tempChat.messages.length === 0) return;

  const permanentMessages = tempChat.messages.map(msg => ({
    chatRoomId: matchId,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.timestamp,
    updatedAt: msg.timestamp
  }));

  await Message.insertMany(permanentMessages);

  await TemporaryChat.findByIdAndDelete(tempChatId);
  console.log(`💬 Moved ${permanentMessages.length} messages to match ${matchId}`);
}
