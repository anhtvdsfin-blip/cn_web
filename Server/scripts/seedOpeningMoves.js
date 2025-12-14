import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import OpeningMove from '../models/OpeningMove.js';

dotenv.config();

const moves = [
  {
    text: "Môn học khó nhằn nhất K67 của bạn là gì? Chắc chắn không phải Giải tích nhỉ?",
    category: 'HocThuat',
    isActive: true,
  },
  {
    text: 'Bạn thường ăn trưa ở đâu? Canteen C1 hay cơm bụi đầu cổng?',
    category: 'SinhVien',
    isActive: true,
  },
  {
    text: 'Bạn nghĩ đâu là địa điểm hẹn hò lãng mạn nhất trong khuôn viên Bách khoa?',
    category: 'CoSoVatChat',
    isActive: true,
  },
  {
    text: "Bạn có hay đi 'Cày' ở thư viện Tạ Quang Bửu không?",
    category: 'ThoiQuen',
    isActive: true,
  },
];

const run = async () => {
  try {
    await connectDB();
    console.log('Seeding OpeningMove documents...');

    for (const m of moves) {
      const existing = await OpeningMove.findOne({ text: m.text }).exec();
      if (existing) {
        await OpeningMove.updateOne({ _id: existing._id }, { $set: { category: m.category, isActive: m.isActive } }).exec();
        console.log('Updated:', m.text);
      } else {
        await OpeningMove.create(m);
        console.log('Inserted:', m.text);
      }
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

run();
