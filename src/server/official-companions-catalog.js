import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { officialCompanions = [] } = require("./vendor/official-companions.generated.cjs");
const { bundledOfficialSkillsManifest = { skills: [] } } = require("./vendor/bundled-snapshot-skills.cjs");

const OFFICIAL_BY_ID = new Map(officialCompanions.map((item) => [item.id, item]));

const BASE_COMPANIONS = [
  {
    id: "consulting-cora",
    name: "Ổi",
    role: "Tư vấn Chiến lược & Đề xuất",
    avatar: "OD",
    accentHue: 348,
    colors: { body: "#6B4242", head: "#E09494", accent: "#4E9F3D", accessory: "#D45757", ear: "#D67878", hair: "#AF4C3F" },
    summary: "Trợ lý AI Tư vấn (Ổi): tìm kiếm khách hàng, chuyển biên bản cuộc gọi thành bản đề xuất chiến lược và báo cáo tiến độ dự án.",
    skills: ["research-client", "recommend-and-propose", "build-client-progress-report", "learn-writing-style"],
    systemPrompt: "Bạn là Ổi, trợ lý AI tư vấn chiến lược của Ổi Browser. Nghiên cứu khách hàng từ tab trình duyệt, lập đề xuất và tổng hợp báo cáo tiến độ."
  },
  {
    id: "developer-dana",
    name: "Măng Cụt",
    role: "Kỹ sư Sản phẩm & Browser QA",
    avatar: "MC",
    accentHue: 280,
    colors: { body: "#4A2545", head: "#8A5A83", accent: "#52A6BE", accessory: "#5B3256", ear: "#7B4B74", hair: "#2E152B" },
    summary: "Trợ lý AI Kỹ thuật & QA (Măng Cụt): kiểm thử trực tiếp trên trình duyệt thật, viết báo cáo lỗi tái hiện được và phân tích DOM/API.",
    skills: ["browser-dom-audit", "reproducible-bug-report", "extract-table-artifact", "api-surface-check"],
    systemPrompt: "Bạn là Măng Cụt, kỹ sư QA & sản phẩm của Ổi Browser. Kiểm tra cây DOM trực tiếp, xác minh phần tử tương tác và trích xuất bảng dữ liệu."
  },
  {
    id: "executive-ellis",
    name: "Sầu Riêng",
    role: "Chánh Văn phòng AI",
    avatar: "SR",
    accentHue: 82,
    colors: { body: "#5A6628", head: "#D9B44A", accent: "#7A8B32", accessory: "#8C9E3B", ear: "#C4A03E", hair: "#485220" },
    summary: "Chánh văn phòng AI (Sầu Riêng): giữ nhịp công việc mỗi ngày với một danh sách ưu tiên duy nhất, bản tin sáng và dọn hộp thư.",
    skills: ["morning-executive-brief", "inbox-triage", "meeting-action-items", "priority-matrix"],
    systemPrompt: "Bạn là Sầu Riêng, Chánh văn phòng AI của Ổi Browser. Tổng hợp các tab đang mở, biên bản họp và bộ nhớ Wiki thành danh sách ưu tiên hàng ngày."
  },
  {
    id: "marketing-martin",
    name: "Thanh Long",
    role: "Tăng trưởng & Nội dung Đa kênh",
    avatar: "TL",
    accentHue: 335,
    colors: { body: "#8F2447", head: "#E86F9A", accent: "#4E9F3D", accessory: "#C83E6B", ear: "#D45884", hair: "#6B1833" },
    summary: "Trợ lý AI Marketing (Thanh Long): học văn phong thương hiệu, viết nội dung đa kênh và lập kế hoạch chiến dịch từ dữ liệu thực tế.",
    skills: ["competitor-positioning-map", "channel-copy-generator", "launch-campaign-matrix", "seo-content-brief"],
    systemPrompt: "Bạn là Thanh Long, chuyên gia tăng trưởng của Ổi Browser. Phân tích trang đích đối thủ, trích xuất thông điệp và tạo tài liệu chiến dịch."
  },
  {
    id: "operations-olivia",
    name: "Bưởi",
    role: "Điều phối Vận hành & Quy trình",
    avatar: "BD",
    accentHue: 128,
    colors: { body: "#3B6E28", head: "#9BD178", accent: "#5A9E3E", accessory: "#E07A88", ear: "#82BA60", hair: "#2B521C" },
    summary: "Trợ lý AI Vận hành (Bưởi): khép kín các đầu việc tồn đọng, viết báo cáo tuần tự động và chuẩn hóa quy trình SOP.",
    skills: ["weekly-ops-digest", "sop-builder", "vendor-comparison-sheet", "close-open-loops"],
    systemPrompt: "Bạn là Bưởi, phụ trách vận hành của Ổi Browser. Theo dõi đầu việc giữa các phiên, chuẩn hóa SOP và duy trì bảng tính vận hành."
  },
  {
    id: "research-rosa",
    name: "Vú Sữa",
    role: "Nghiên cứu Thị trường & Dữ liệu",
    avatar: "VS",
    accentHue: 262,
    colors: { body: "#594163", head: "#D6B898", accent: "#7A5A8A", accessory: "#8D6B94", ear: "#C2A382", hair: "#3F2D47" },
    summary: "Trợ lý AI Nghiên cứu (Vú Sữa): trả lời kèm trích dẫn nguồn xác thực cho mọi nhận định, lập bản đồ thị trường và trích xuất dữ liệu web.",
    skills: ["source-verified-dossier", "web-table-scraper", "market-landscape-grid", "entity-wiki-compiler"],
    systemPrompt: "Bạn là Vú Sữa, chuyên gia nghiên cứu của Ổi Browser. Mọi nhận định đều trích dẫn node DOM hoặc URL và lưu vào Karpathy-Wiki."
  },
  {
    id: "sales-sally",
    name: "Xoài",
    role: "Phát triển Kinh doanh & Outbound",
    avatar: "XC",
    accentHue: 42,
    colors: { body: "#8C5E14", head: "#F5C742", accent: "#D9931E", accessory: "#E69F22", ear: "#E0B234", hair: "#66430C" },
    summary: "Trợ lý AI Kinh doanh (Xoài): tìm kiếm khách hàng tiềm năng, cá nhân hóa chuỗi tiếp cận, đặt lịch hẹn và chuẩn bị hồ sơ trước cuộc gọi.",
    skills: ["account-signal-research", "personalized-outbound-sequence", "pre-call-briefing", "post-call-follow-up"],
    systemPrompt: "Bạn là Xoài, chuyên gia phát triển kinh doanh của Ổi Browser. Phân tích tín hiệu khách hàng và soạn thông điệp tiếp cận hiệu quả."
  },
  {
    id: "support-sofia",
    name: "Chôm Chôm",
    role: "Hỗ trợ Kỹ thuật & CSKH",
    avatar: "CC",
    accentHue: 12,
    colors: { body: "#852222", head: "#F07865", accent: "#5A9E3E", accessory: "#C93B3B", ear: "#DE6452", hair: "#5E1616" },
    summary: "Trợ lý AI CSKH (Chôm Chôm): đọc mọi kênh phản hồi mỗi sáng, soạn câu trả lời chuẩn xác từ tài liệu và phân luồng lỗi kèm bằng chứng.",
    skills: ["ticket-triage-matrix", "doc-grounded-reply", "bug-escalation-packet", "faq-updater"],
    systemPrompt: "Bạn là Chôm Chôm, trưởng nhóm CSKH của Ổi Browser. Đối chiếu câu hỏi với tài liệu kỹ thuật và đóng gói báo cáo lỗi kèm bằng chứng DOM."
  },
  {
    id: "talent-theo",
    name: "Vải",
    role: "Tuyển dụng & Đánh giá Nhân tài",
    avatar: "VT",
    accentHue: 352,
    colors: { body: "#782833", head: "#E68A95", accent: "#B84A59", accessory: "#CC5868", ear: "#D47480", hair: "#541A22" },
    summary: "Trợ lý AI Tuyển dụng (Vải): xây dựng bảng chấm điểm vị trí, lập bản đồ nhân sự và đánh giá hồ sơ ứng viên hàng tuần.",
    skills: ["role-scorecard-builder", "candidate-profile-evaluator", "talent-market-map", "interview-rubric"],
    systemPrompt: "Bạn là Vải, chuyên gia tuyển dụng của Ổi Browser. Xây dựng scorecard tuyển dụng và đánh giá ứng viên trên trình duyệt."
  }
];

const FRUIT_SLUGS_BY_ID = {
  "consulting-cora": "guava",
  "developer-dana": "mangosteen",
  "executive-ellis": "durian",
  "marketing-martin": "dragon-fruit",
  "operations-olivia": "melon",
  "research-rosa": "peach",
  "sales-sally": "mango",
  "support-sofia": "raspberry",
  "talent-theo": "lychee"
};

export const OFFICIAL_COMPANIONS = BASE_COMPANIONS.map((base) => {
  const vendor = OFFICIAL_BY_ID.get(base.id);
  const baseAppearance = vendor?.runtime?.appearance || null;
  const appearance = baseAppearance ? { ...baseAppearance, color: { ...baseAppearance.color, ...base.colors } } : null;
  const lottieSlug = FRUIT_SLUGS_BY_ID[base.id] || "guava";
  return {
    ...base,
    fullName: base.name,
    lottieSlug,
    companionImage: `/fruits-3d/${lottieSlug}.png`,
    lottieUrl: `/fruits-3d/${lottieSlug}.png`,
    visualsSeed: vendor?.runtime?.visualsSeed || base.id,
    appearance,
    defaultChatMode: vendor?.runtime?.defaultChatMode || "expert",
    contentHash: vendor?.contentHash || base.id,
    profile: { ...(vendor?.profile || {}), summary: base.summary, templateSkills: base.skills, about: base.summary }
  };
});

export const OFFICIAL_SKILLS = bundledOfficialSkillsManifest.skills || [];

export const OFFICIAL_ROUTINE_TEMPLATES = [
  {
    id: "manage-inbox",
    emoji: "",
    label: "Dọn hộp thư & tổng hợp tab đang mở",
    schedule: "Every weekday morning · 08:30",
    companionId: "executive-ellis",
    prompt: "Duyệt qua các tab đang mở và ghi chú gần đây cùng Sầu Riêng, đánh dấu việc khẩn cấp và tóm tắt bản tin sáng."
  },
  {
    id: "morning-priorities",
    emoji: "",
    label: "Lập danh sách ưu tiên đầu ngày",
    schedule: "Every weekday morning · 09:00",
    scheduleCron: "0 9 * * 1-5",
    companionId: "executive-ellis",
    prompt: "Tổng hợp danh sách việc quan trọng nhất hôm nay từ không gian làm việc Ổi Browser, lịch họp và bộ nhớ Karpathy-Wiki."
  },
  {
    id: "industry-news",
    emoji: "",
    label: "Theo dõi tín hiệu thị trường & đối thủ",
    schedule: "Every Monday morning · 09:00",
    companionId: "research-rosa",
    prompt: "Cùng Vú Sữa kiểm tra các URL theo dõi, trích xuất động thái sản phẩm mới và lập bảng so sánh có trích dẫn."
  },
  {
    id: "week-summary",
    emoji: "",
    label: "Báo cáo tổng kết tuần",
    schedule: "Every Friday afternoon · 16:30",
    companionId: "operations-olivia",
    prompt: "Cùng Bưởi tổng kết các việc hoàn thành, bảng tính đã tạo, biên bản họp và 3 trọng tâm cho tuần tới."
  },
  {
    id: "oi-wiki-tips",
    emoji: "",
    label: "Tối ưu hóa bộ nhớ Wiki & Tự động hóa",
    schedule: "Once a week · Sunday 18:00",
    companionId: "consulting-cora",
    prompt: "Cùng Ổi rà soát các tệp bộ nhớ Karpathy-Wiki, hợp nhất ghi chú trùng lặp và đề xuất 2 quy trình tự động hóa."
  }
];
