import express from 'express';
import multer from 'multer';
import matchingService from '../services/MatchingService.js';
import { getMatchedUsers } from '../controllers/matchControllers.js';
import { getMessages, sendMessage, uploadChatImage } from '../controllers/conversationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/match/calculate
router.post('/calculate', async (req, res) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({
        success: false,
        error: 'Missing user1 or user2'
      });
    }

    const requiredFields = ['gender', 'age', 'career', 'hobbies', 'location', 'zodiac'];
    for (const field of requiredFields) {
      if (!user1[field] || !user2[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }

    const result = await matchingService.calculateCompatibility(user1, user2);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error calculating compatibility:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /api/match/find-matches
router.post('/find-matches', async (req, res) => {
  try {
    const { currentUser, candidates, limit = 10 } = req.body;

    if (!currentUser) {
      return res.status(400).json({
        success: false,
        error: 'Missing currentUser'
      });
    }

    if (!candidates || !Array.isArray(candidates)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid candidates array'
      });
    }

    const matches = await matchingService.findMatches(
      currentUser,
      candidates,
      Math.min(limit, 50)
    );

    res.json({
      success: true,
      data: {
        total: matches.length,
        matches: matches.map(m => ({
          userId: m.user.id,
          userName: m.user.name,
          score: m.compatibility.overallScore,
          recommendation: m.compatibility.recommendation,
          breakdown: m.compatibility.breakdown
        }))
      }
    });

  } catch (error) {
    console.error('Error finding matches:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/match/health
router.get('/health', async (req, res) => {
  try {
    const stats = matchingService.getStats();
    
    res.json({
      success: true,
      status: stats.ready ? 'healthy' : 'initializing',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// POST /api/match/career-similarity
router.post('/career-similarity', async (req, res) => {
  try {
    const { career1, career2 } = req.body;

    if (!career1 || !career2) {
      return res.status(400).json({
        success: false,
        error: 'Missing career1 or career2'
      });
    }

    const similarity = await matchingService.matcher.calculateCareerSimilarity(career1, career2);

    res.json({
      success: true,
      data: {
        career1,
        career2,
        similarity: Math.round(similarity * 100) / 100,
        percentage: Math.round(similarity * 100)
      }
    });

  } catch (error) {
    console.error('Error calculating career similarity:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/match/hobby-similarity
router.post('/hobby-similarity', async (req, res) => {
  try {
    const { hobbies1, hobbies2 } = req.body;

    if (!Array.isArray(hobbies1) || !Array.isArray(hobbies2)) {
      return res.status(400).json({
        success: false,
        error: 'hobbies1 and hobbies2 must be arrays'
      });
    }

    const result = await matchingService.matcher.matchHobbyLists(hobbies1, hobbies2);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error calculating hobby similarity:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/match/matched-users/:userId
router.get('/matched-users/:userId', getMatchedUsers);

const upload = multer({ storage: multer.memoryStorage() });

// Backwards-compatible message routes under /api/match/:matchId
router.get('/:matchId/messages', requireAuth, getMessages);
router.post('/:matchId/messages', requireAuth, sendMessage);
router.post('/:matchId/upload', requireAuth, upload.single('image'), uploadChatImage);

export default router;