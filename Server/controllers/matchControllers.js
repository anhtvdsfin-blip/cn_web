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
    
    const matches = await Match.find({
      $or: [
        { user1Id: userId, status: 'active' },
        { user2Id: userId, status: 'active' }
      ]
    }).populate('user1Id', 'name avatar').populate('user2Id', 'name avatar');

    const matchedUsers = matches.map(match => {
      const otherUser = String(match.user1Id._id) === userId ? match.user2Id : match.user1Id;
      return {
        _id: otherUser._id,
        id: otherUser._id,
        name: otherUser.name,
        avatar: otherUser.avatar
      };
    });

    res.json({ success: true, matchedUsers });
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách matched users:", err);
    res.status(500).json({ success: false, message: "Lỗi server!" });
  }
};
