import OpeningMove from '../models/OpeningMove.js';

export const listOpeningMoves = async (req, res) => {
  try {
    const { active } = req.query;
    const query = {};
    if (active === '1' || active === 'true') query.isActive = true;

    const moves = await OpeningMove.find(query).sort({ createdAt: 1 }).lean().exec();
    return res.json({ success: true, data: moves });
  } catch (error) {
    console.error('listOpeningMoves error', error);
    return res.status(500).json({ success: false, message: 'Không thể tải Opening Moves.' });
  }
};
