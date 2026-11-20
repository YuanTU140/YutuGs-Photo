export type BagType = "常规编织袋" | "方底编织袋" | "常规 PE 袋";
export type PackagingTemplate = {
  id: string;
  bagType: BagType;
  capacity?: string;
  widthCm: number;
  heightCm: number;
  leftMFoldCm: number;
  rightMFoldCm: number;
  note?: string;
};

// 宽度统一定义为袋子完全展开后的总宽度，包含 M 折部分。
export const packagingTemplates: PackagingTemplate[] = [
  { id: "woven-1kg-25x35", bagType: "常规编织袋", capacity: "1公斤", widthCm: 25, heightCm: 35, leftMFoldCm: 0, rightMFoldCm: 0 },
  { id: "woven-5kg-30x45", bagType: "常规编织袋", capacity: "5公斤", widthCm: 30, heightCm: 45, leftMFoldCm: 0, rightMFoldCm: 0 },
  { id: "woven-5kg-35x45-m6", bagType: "常规编织袋", capacity: "5公斤", widthCm: 35, heightCm: 45, leftMFoldCm: 6, rightMFoldCm: 0 },
  { id: "woven-10kg-40x60-m8", bagType: "常规编织袋", capacity: "10公斤", widthCm: 40, heightCm: 60, leftMFoldCm: 8, rightMFoldCm: 0 },
  { id: "woven-10kg-38x58-m8", bagType: "常规编织袋", capacity: "10公斤", widthCm: 38, heightCm: 58, leftMFoldCm: 8, rightMFoldCm: 0 },
  { id: "woven-20kg-45x75-m8", bagType: "常规编织袋", capacity: "20公斤", widthCm: 45, heightCm: 75, leftMFoldCm: 8, rightMFoldCm: 0 },
  { id: "woven-25kg-50x80-m10", bagType: "常规编织袋", capacity: "25公斤", widthCm: 50, heightCm: 80, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "woven-40kg-55x100-m10", bagType: "常规编织袋", capacity: "40公斤", widthCm: 55, heightCm: 100, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "woven-40kg-55x102-m10", bagType: "常规编织袋", capacity: "40公斤", widthCm: 55, heightCm: 102, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "woven-40kg-55x103-m10", bagType: "常规编织袋", capacity: "40公斤", widthCm: 55, heightCm: 103, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "woven-50kg-58x100-m10", bagType: "常规编织袋", capacity: "50公斤", widthCm: 58, heightCm: 100, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "woven-50kg-58x103-m10", bagType: "常规编织袋", capacity: "50公斤", widthCm: 58, heightCm: 103, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "woven-50kg-60x103-m10", bagType: "常规编织袋", capacity: "50公斤", widthCm: 60, heightCm: 103, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "square-10kg-40x60-m10", bagType: "方底编织袋", capacity: "10公斤", widthCm: 40, heightCm: 60, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "square-20kg-45x75-m10", bagType: "方底编织袋", capacity: "20公斤", widthCm: 45, heightCm: 75, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "pe-38x58", bagType: "常规 PE 袋", widthCm: 38, heightCm: 58, leftMFoldCm: 0, rightMFoldCm: 0 },
  { id: "pe-38x58-m10", bagType: "常规 PE 袋", widthCm: 38, heightCm: 58, leftMFoldCm: 10, rightMFoldCm: 0 },
  { id: "pe-45x70-m10", bagType: "常规 PE 袋", widthCm: 45, heightCm: 70, leftMFoldCm: 10, rightMFoldCm: 0 },
];

export const getTemplateLabel = (t: PackagingTemplate) =>
  `${t.capacity ? `${t.capacity} · ` : ""}${t.widthCm} × ${t.heightCm} cm${t.leftMFoldCm ? ` · 左侧 M 折 ${t.leftMFoldCm} cm` : " · 无 M 折"}`;
