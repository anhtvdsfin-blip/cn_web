import { pipeline } from '@xenova/transformers';

class TextEmbeddingMatcher {
  constructor() {
    this.embedder = null;
    this.cache = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🚀 Loading embedding model...');
    
    try {
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        { quantized: true }
      );
      
      this.isInitialized = true;
      console.log('✅ Embedding model loaded successfully!');
    } catch (error) {
      console.error('❌ Error loading model:', error);
      throw error;
    }
  }

  async getEmbedding(text) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cacheKey = text.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true
      });

      const embedding = Array.from(output.data);
      this.cache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  async calculateCareerSimilarity(career1, career2) {
    const emb1 = await this.getEmbedding(career1);
    const emb2 = await this.getEmbedding(career2);
    
    const similarity = this.cosineSimilarity(emb1, emb2);
    return Math.max(0, Math.min(1, similarity));
  }

  async calculateHobbySimilarity(hobby1, hobby2) {
    const emb1 = await this.getEmbedding(hobby1);
    const emb2 = await this.getEmbedding(hobby2);
    
    return this.cosineSimilarity(emb1, emb2);
  }

  async matchHobbyLists(hobbies1, hobbies2) {
  // Normalize inputs: split any comma-separated hobby strings into individual items
  const normalizeList = (arr) => (arr || []).flatMap(item => {
    if (typeof item !== 'string') return [];
    return item.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
  });

  const list1 = normalizeList(hobbies1);
  const list2 = normalizeList(hobbies2);

  if (!list1.length || !list2.length) {
    return { score: 0, matches: [], totalMatches: 0 };
  }

  console.log('\n🎯 HOBBY MATCHING DEBUG:');
  console.log('Raw User1 hobbies:', hobbies1);
  console.log('Raw User2 hobbies:', hobbies2);
  console.log('Normalized User1 hobbies:', list1);
  console.log('Normalized User2 hobbies:', list2);

  const embeddings1 = await Promise.all(
    list1.map(h => this.getEmbedding(h))
  );
  const embeddings2 = await Promise.all(
    list2.map(h => this.getEmbedding(h))
  );

  const matches = [];
  let totalScore = 0;

  for (let i = 0; i < list1.length; i++) {
    let maxSim = 0;
    let bestMatchIdx = -1;

    console.log(`\n  Comparing "${list1[i]}":`);

    for (let j = 0; j < list2.length; j++) {
      const sim = this.cosineSimilarity(embeddings1[i], embeddings2[j]);

      console.log(`    → "${list2[j]}": ${(sim * 100).toFixed(1)}%`);

      if (sim > maxSim) {
        maxSim = sim;
        bestMatchIdx = j;
      }
    }

    const bestMatch = bestMatchIdx !== -1 ? list2[bestMatchIdx] : null;
    console.log(`    ✅ Best match: "${bestMatch}" (${(maxSim * 100).toFixed(1)}%)`);

    if (maxSim >= 0 && bestMatchIdx !== -1) {
      matches.push({
        hobby1: list1[i],
        hobby2: list2[bestMatchIdx],
        similarity: Math.round(maxSim * 100) / 100
      });
      totalScore += maxSim;
    }
  }

  const score = (totalScore / list1.length) * 100;

  console.log(`\n  📊 Final hobby score: ${score.toFixed(1)}%`);
  console.log(`  🎯 Matches found: ${matches.length}/${list1.length}`);

  return {
    score: Math.round(score * 10) / 10,
    matches,
    totalMatches: matches.length
  };
}

  calculateZodiacCompatibility(zodiac1, zodiac2) {
    const compatibility = {
      "Bạch Dương": { compatible: ["Sư Tử", "Nhân Mã", "Song Tử"], conflict: ["Thiên Bình", "Cự Giải"] },
      "Kim Ngưu": { compatible: ["Xử Nữ", "Ma Kết", "Cự Giải"], conflict: ["Bọ Cạp", "Sư Tử"] },
      "Song Tử": { compatible: ["Thiên Bình", "Bảo Bình", "Bạch Dương"], conflict: ["Nhân Mã", "Xử Nữ"] },
      "Cự Giải": { compatible: ["Bọ Cạp", "Song Ngư", "Kim Ngưu"], conflict: ["Bạch Dương", "Ma Kết"] },
      "Sư Tử": { compatible: ["Bạch Dương", "Nhân Mã", "Song Tử"], conflict: ["Kim Ngưu", "Bọ Cạp"] },
      "Xử Nữ": { compatible: ["Kim Ngưu", "Ma Kết", "Cự Giải"], conflict: ["Song Tử", "Nhân Mã"] },
      "Thiên Bình": { compatible: ["Song Tử", "Bảo Bình", "Sư Tử"], conflict: ["Bạch Dương", "Cự Giải"] },
      "Bọ Cạp": { compatible: ["Cự Giải", "Song Ngư", "Xử Nữ"], conflict: ["Kim Ngưu", "Sư Tử"] },
      "Nhân Mã": { compatible: ["Bạch Dương", "Sư Tử", "Thiên Bình"], conflict: ["Song Tử", "Xử Nữ"] },
      "Ma Kết": { compatible: ["Kim Ngưu", "Xử Nữ", "Bọ Cạp"], conflict: ["Bạch Dương", "Thiên Bình"] },
      "Bảo Bình": { compatible: ["Song Tử", "Thiên Bình", "Bạch Dương"], conflict: ["Kim Ngưu", "Sư Tử"] },
      "Song Ngư": { compatible: ["Cự Giải", "Bọ Cạp", "Kim Ngưu"], conflict: ["Song Tử", "Xử Nữ"] },
    };

    const z1 = compatibility[zodiac1];
    if (!z1) return 0.5;

    if (z1.compatible.includes(zodiac2)) return 1.0;
    if (z1.conflict.includes(zodiac2)) return 0.3;
    return 0.6;
  }

  calculateAgeCompatibility(age1, age2) {
    const diff = Math.abs(age1 - age2);
    
    if (diff <= 2) return 1.0;
    if (diff <= 5) return 0.8;
    if (diff <= 8) return 0.6;
    if (diff <= 12) return 0.4;
    return 0.2;
  }

  calculateLocationCompatibility(loc1, loc2) {
    const regions = {
      "Miền Bắc": ["Hà Nội", "Hải Phòng", "Quảng Ninh", "Nam Định", "Thái Bình"],
      "Miền Trung": ["Đà Nẵng", "Huế", "Quảng Nam", "Quảng Ngãi", "Nha Trang"],
      "Miền Nam": ["TP.HCM", "Biên Hòa", "Vũng Tàu", "Cần Thơ", "Long An"],
    };

    if (loc1 === loc2) return 1.0;

    const getRegion = (loc) => {
      for (const [region, cities] of Object.entries(regions)) {
        if (cities.some(city => loc.includes(city))) return region;
      }
      return null;
    };

    const r1 = getRegion(loc1);
    const r2 = getRegion(loc2);

    if (r1 && r2 && r1 === r2) return 0.7;
    return 0.4;
  }

  checkGenderCompatibility(user1, user2) {
    if (user1.lookingFor && user2.lookingFor) {
      const match1 = user1.lookingFor === user2.gender;
      const match2 = user2.lookingFor === user1.gender;
      
      if (match1 && match2) return 1.0;
      if (match1 || match2) return 0.5;
      return 0.0;
    }
    
    if ((user1.gender === "Nam" && user2.gender === "Nữ") ||
        (user1.gender === "Nữ" && user2.gender === "Nam")) {
      return 1.0;
    }
    
    return 0.5;
  }

  async calculateOverallCompatibility(user1, user2) {
    const weights = {
      gender: 0.20,
      hobbies: 0.25,
      age: 0.15,
      career: 0.15,
      location: 0.15,
      zodiac: 0.10,
    };

    let totalScore = 0;
    const breakdown = {};

    // 1. Giới tính
    const genderScore = this.checkGenderCompatibility(user1, user2);
    breakdown.gender = Math.round(genderScore * 100);
    console.log(`♉ Điểm giới tính :`, Math.round(genderScore * 100));

    // 2. Sở thích
    console.log(`sở thích của 2 user :`,user1.hobbies, user2.hobbies)
    const hobbyResult = await this.matchHobbyLists(user1.hobbies, user2.hobbies);
    breakdown.hobbies = hobbyResult.score;
    breakdown.hobbyMatches = hobbyResult.matches;
    console.log(`♊ Điểm sở thích :`, Math.round(hobbyResult.score));
    console.log('Chi tiết sở thích trùng:', hobbyResult.matches);

    // 3. Tuổi
    const ageScore = this.calculateAgeCompatibility(user1.age, user2.age);
    breakdown.age = Math.round(ageScore * 100);
    console.log(`♋ Điểm tuổi :`, Math.round(ageScore * 100));

    // 4. Nghề nghiệp
    const careerScore = await this.calculateCareerSimilarity(user1.career, user2.career);
    breakdown.career = Math.round(careerScore * 100);
    console.log(`♌ Điểm nghề nghiệp :`, Math.round(careerScore * 100));

    // 5. Quê quán
    const locationScore = this.calculateLocationCompatibility(user1.location, user2.location);
    breakdown.location = Math.round(locationScore * 100);
    console.log(`♍ Điểm quê quán :`, Math.round(locationScore * 100));

    // 6. Cung hoàng đạo
    const zodiacScore = this.calculateZodiacCompatibility(user1.zodiac, user2.zodiac);
    breakdown.zodiac = Math.round(zodiacScore * 100);
    console.log(`♎ Điểm cung hoàng đạo :`, Math.round(zodiacScore * 100));

    // Tổng điểm
    totalScore += genderScore * weights.gender;
    totalScore += (hobbyResult.score / 100) * weights.hobbies;
    totalScore += ageScore * weights.age;
    totalScore += careerScore * weights.career;
    totalScore += locationScore * weights.location;
    totalScore += zodiacScore * weights.zodiac;

    const overallScore = Math.round(totalScore * 100);
    console.log(`📊 Tổng điểm tương thích: ${overallScore}`);

    return {
      overallScore,
      breakdown,
      recommendation: this.getRecommendation(overallScore),
      timestamp: new Date().toISOString()
    };
  }

  getRecommendation(score) {
    if (score >= 80) return "Rất phù hợp! 💕";
    if (score >= 70) return "Khá phù hợp! ✨";
    if (score >= 60) return "Có thể thử! 🌟";
    if (score >= 50) return "Tạm được 🤔";
    return "Ít phù hợp 😅";
  }

  // services/TextEmbeddingMatcher.js hoặc MatchingService.js

async findBestMatches(currentUser, userList, topK = 10) {
  const results = [];
  
  for (const user of userList) {
    if (user.id === currentUser.id) continue;
    
    const compatibility = await this.calculateOverallCompatibility(currentUser, user);
  
    results.push({
      user,
      compatibility
    });
  }
  
  results.sort((a, b) => b.compatibility.overallScore - a.compatibility.overallScore);
  
  return results.slice(0, topK);
}


  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      isInitialized: this.isInitialized
    };
  }
}

export default TextEmbeddingMatcher;