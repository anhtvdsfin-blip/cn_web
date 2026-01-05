import User from "../models/User.js";
import Match from "../models/Match.js";

// Deprecated: getMatchSuggestions (sử dụng MatchingService từ matchRoutes.js)
/*
export const getMatchSuggestions = async (req, res) => {
  try {
    const currentUser = await User.findById(req.params.userId);
    if (!currentUser) return res.status(404).json({ message: "Không tìm thấy người dùng!" });

    const allUsers = await User.find({ _id: { $ne: currentUser._id } });

    const results = [];
    for (const user of allUsers) {
      const { score, hobbyMatches } = await matchService.calculateMatchScore(currentUser, user);
      results.push({
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        score,
        hobbies: hobbyMatches,
      });
    }

    // Sắp xếp theo độ tương thích giảm dần
    results.sort((a, b) => b.score - a.score);

    res.json({ success: true, matches: results });
  } catch (err) {
    console.error("❌ Lỗi khi ghép đôi:", err);
    res.status(500).json({ message: "Lỗi server!" });
  }
};
*/

export const getMatchedUsers = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // include both active (ongoing temp matches) and matched (permanent matches)
    const matches = await Match.find({
      $and: [
        { $or: [ { user1Id: userId }, { user2Id: userId } ] },
        { status: { $in: ['active', 'matched'] } }
      ]
    }).populate('user1Id', 'name avatar').populate('user2Id', 'name avatar');

    console.log(`ℹ️ Found ${matches.length} matches for user ${userId}`);

    // Deduplicate by partner user id: prefer a 'matched' status over 'active', then newest updatedAt
    const byPartner = new Map();
    for (const m of matches) {
      // Skip matches where either user has been deleted from DB
      if (!m.user1Id || !m.user2Id) {
        console.log(`⚠️ Skipping match ${m._id} - one of the users has been deleted`);
        continue;
      }
      
      const otherUser = String(m.user1Id._id) === userId ? m.user2Id : m.user1Id;
      const otherId = otherUser._id.toString();
      if (!byPartner.has(otherId)) {
        byPartner.set(otherId, m);
        continue;
      }
      const existing = byPartner.get(otherId);
      // prefer matched over active
      if (existing.status === 'matched' && m.status !== 'matched') continue;
      if (m.status === 'matched' && existing.status !== 'matched') {
        byPartner.set(otherId, m);
        continue;
      }
      // otherwise pick most recently updated
      const existingDate = new Date(existing.updatedAt || existing.createdAt || 0);
      const mDate = new Date(m.updatedAt || m.createdAt || 0);
      if (mDate > existingDate) byPartner.set(otherId, m);
    }

    const matchedUsers = Array.from(byPartner.values()).map((matchDoc) => {
      const otherUser = String(matchDoc.user1Id._id) === userId ? matchDoc.user2Id : matchDoc.user1Id;
      return {
        _id: matchDoc._id,
        matchId: matchDoc._id,
        id: otherUser._id,
        userId: otherUser._id,
        name: otherUser.name,
        avatar: otherUser.avatar,
        status: matchDoc.status,
        lastMessage: matchDoc.lastMessage || null,
        updatedAt: matchDoc.updatedAt
      };
    });

    res.json({ success: true, matchedUsers });
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách matched users:", err);
    res.status(500).json({ success: false, message: "Lỗi server!" });
  }
};
