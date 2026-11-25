#!/usr/bin/env python3
"""
Trình sinh giọng đọc AI Neural tiếng Việt miễn phí (edge-tts) cho dự án Kinh Thành Huế 1880 3D.
- Giọng Nữ Thuyết minh Di sản: vi-VN-HoaiMyNeural (trầm ấm, chuẩn bảo tàng di sản)
- Giọng Nam Quan Triều đình / NPC Nhiệm vụ: vi-VN-NamMinhNeural (uy nghiêm, cổ phong 1880)
Xuất tệp tĩnh MP3 nhẹ (48 kbps) vào assets/voice/ và cập nhật assets/voice/voice_manifest.json.
"""

from __future__ import annotations

import asyncio
import datetime
import hashlib
import json
import pathlib
import subprocess

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE_DIR = ROOT / "assets" / "voice"

VOICE_PROFILES = {
    "narrator_female": {
        "voice": "vi-VN-HoaiMyNeural",
        "rate": "-5%",
        "pitch": "-1Hz",
        "speaker_label": "Thuyết minh Di sản",
    },
    "official_male": {
        "voice": "vi-VN-NamMinhNeural",
        "rate": "-6%",
        "pitch": "-3Hz",
        "speaker_label": "Quan Triều Đình · Tự Đức 1880",
    },
}

VOICE_ENTRIES = [
    # --- 10 BẢN THUYẾT MINH DI SẢN (NỮ TRẦM ẤM) ---
    {
        "id": "narration_T28",
        "category": "narration",
        "tile_ids": ["T28", "T29"],
        "profile": "narrator_female",
        "title": "Bến Nghênh Lương Đình và Phu Văn Lâu",
        "text": (
            "Từ bến ngự bên dòng sông Hương nhìn lên, hai nếp mái cong của Nghênh Lương Tạ và Phu Văn Lâu "
            "mở đầu trục Thần đạo của Kinh thành Huế. Phu Văn Lâu dựng năm 1819 dưới triều Gia Long là nơi "
            "niêm yết chiếu chỉ của nhà vua và bảng vàng khoa cử. Phía trước là Nghênh Lương Tạ dựng năm 1852, "
            "nơi vua Tự Đức dừng chân hóng mát và ngự thuyền rồng trên dòng Hương Giang."
        ),
    },
    {
        "id": "narration_T01",
        "category": "narration",
        "tile_ids": ["T01"],
        "profile": "narrator_female",
        "title": "Kỳ Đài và Cửu Vị Thần Công",
        "text": (
            "Sừng sững ở chính mặt nam Kinh thành là Kỳ Đài ba tầng xây gạch vồ từ năm 1807 thời Gia Long. "
            "Vào năm 1880, cột cờ trên đỉnh đài vẫn làm bằng gỗ lim hai tầng có vọng đẩu canh gác. "
            "Hai bên tả hữu quảng trường là Pháo xưởng đặt Cửu Vị Thần Công, chín khẩu đại bác bằng đồng "
            "tượng trưng cho bốn mùa và ngũ hành bảo hộ kinh đô."
        ),
    },
    {
        "id": "narration_T02",
        "category": "narration",
        "tile_ids": ["T02"],
        "profile": "narrator_female",
        "title": "Ngọ Môn và Lầu Ngũ Phụng",
        "text": (
            "Ngọ Môn được vua Minh Mạng cho xây dựng năm 1833 trên nền đài đá Thanh và gạch vồ hình chữ U, "
            "mở năm lối đi nghiêm cẩn. Cửa chính giữa chỉ dành riêng cho Hoàng đế. Phía trên là Lầu Ngũ Phụng "
            "nâng chín bộ mái ngói lưu ly vàng và xanh trên một trăm cột gỗ lim, nơi nhà vua ngự ban lịch "
            "và dự lễ Truyền lô xướng danh tân tiến sĩ."
        ),
    },
    {
        "id": "narration_T04",
        "category": "narration",
        "tile_ids": ["T04", "T03"],
        "profile": "narrator_female",
        "title": "Cầu Trung Đạo và Điện Thái Hòa",
        "text": (
            "Bước qua cầu Trung Đạo giữa mặt nước hồ Thái Dịch là sân Đại Triều Nghi hai tầng đá Thanh "
            "dẫn lên Điện Thái Hòa, trung tâm quyền lực tối cao của triều Nguyễn. Ngôi điện xây theo thức "
            "trùng thiềm điệp ốc lợp ngói Hoàng lưu ly, bên trong tám mươi cột gỗ lim sơn son thếp vàng "
            "nâng đỡ vòm trần và bệ Ngai vàng dưới Bửu tán cửu long."
        ),
    },
    {
        "id": "narration_T06",
        "category": "narration",
        "tile_ids": ["T06", "T05"],
        "profile": "narrator_female",
        "title": "Đại Cung Môn và Điện Cần Chánh",
        "text": (
            "Qua khỏi Đại Cung Môn là không gian thâm nghiêm của Tử Cấm Thành với tâm điểm là Điện Cần Chánh "
            "dựng từ năm 1804. Nếu Điện Thái Hòa dành cho lễ Đại triều, thì Điện Cần Chánh là nơi Hoàng đế "
            "thiết thường triều, giải quyết chính sự hằng ngày cùng Nội các và khoản đãi các đoàn sứ bộ."
        ),
    },
    {
        "id": "narration_T09",
        "category": "narration",
        "tile_ids": ["T09"],
        "profile": "narrator_female",
        "title": "Thế Tổ Miếu, Hiển Lâm Các và Cửu Đỉnh",
        "text": (
            "Ở góc tây nam Hoàng thành là Thế Tổ Miếu dựng năm 1821, nơi thờ các vị vua triều Nguyễn. "
            "Trước sân miếu, đối diện lầu Hiển Lâm Các cao mười bảy mét là chín đỉnh đồng Cửu Đỉnh đúc từ năm "
            "1835 đến năm 1837. Trên thân chín đỉnh chạm nổi một trăm sáu mươi hai họa tiết núi sông, "
            "sản vật và biển đảo như bộ bách khoa thư bằng đồng của nước Đại Nam."
        ),
    },
    {
        "id": "narration_T11",
        "category": "narration",
        "tile_ids": ["T11"],
        "profile": "narrator_female",
        "title": "Cung Diên Thọ",
        "text": (
            "Phía tây Tử Cấm Thành là Cung Diên Thọ, quần thể cung điện và vườn cảnh dành phụng dưỡng "
            "Hoàng thái hậu Từ Dụ dưới triều Tự Đức. Chính điện thanh nhã nối liền lầu Khương Ninh Các "
            "và thủy tạ Trường Du Tạ soi bóng bên mặt hồ sen tĩnh lặng."
        ),
    },
    {
        "id": "narration_T15",
        "category": "narration",
        "tile_ids": ["T15"],
        "profile": "narrator_female",
        "title": "Nhà hát Duyệt Thị Đường",
        "text": (
            "Nằm phía đông nam Tử Cấm Thành là Duyệt Thị Đường, nhà hát cung đình cổ nhất Việt Nam "
            "được dựng năm Minh Mạng thứ bảy, tức năm 1826. Dưới vòm trần xanh vẽ trăng sao và mây rồng, "
            "nhà vua cùng hoàng gia và quần thần thưởng thức tuồng cung đình cùng Nhã nhạc Đại Nội."
        ),
    },
    {
        "id": "narration_T20",
        "category": "narration",
        "tile_ids": ["T20"],
        "profile": "narrator_female",
        "title": "Đàn Xã Tắc",
        "text": (
            "Phía tây Hoàng thành là Đàn Xã Tắc đắp năm 1806 bằng đất sạch ngũ sắc gom từ khắp các trấn thành "
            "trong cả nước. Hằng năm vào mùa xuân và mùa thu, đích thân nhà vua hoặc khâm mạng đại thần "
            "cử hành đại lễ tế Thần Đất và Thần Lúa cầu cho quốc thái dân an, mùa màng tươi tốt."
        ),
    },
    {
        "id": "narration_T24",
        "category": "narration",
        "tile_ids": ["T24"],
        "profile": "narrator_female",
        "title": "Tàng Thư Lâu và Hồ Học Hải",
        "text": (
            "Giữa mặt nước vuông vức của hồ Học Hải phía đông bắc Kinh thành là Tàng Thư Lâu xây dựng năm 1825. "
            "Tòa lầu hai tầng bằng gạch và đá nằm biệt lập trên đảo giữa hồ, nối với bờ chỉ bằng một chiếc cầu đá "
            "nhằm chống ẩm và ngăn hỏa hoạn, bảo vệ hàng vạn tập Châu bản, Quốc sử và Địa bạ triều đình."
        ),
    },
    # --- 8 BẢN THOẠI NHIỆM VỤ QUAN TRIỀU ĐÌNH (NAM UY NGHIÊM) ---
    {
        "id": "quest_01_intro",
        "category": "quest",
        "quest_id": "Q01",
        "profile": "official_male",
        "speaker_override": "Quan Truyền Lô Bộ Lễ",
        "title": "Chương 1: Truyền Lô Bến Ngự",
        "text": (
            "Chúc mừng tân khoa tiến sĩ vừa đỗ đạt Ân khoa năm Tự Đức thứ ba mươi ba. "
            "Bảng vàng vừa được rước ra niêm yết tại Phu Văn Lâu trước bến sông Hương này. "
            "Hãy trả lời câu hỏi khảo cứu nghi điển để nhận Lệnh Bài Nhập Thành, bắt đầu hành trình tiến cung."
        ),
    },
    {
        "id": "quest_02_intro",
        "category": "quest",
        "quest_id": "Q02",
        "profile": "official_male",
        "speaker_override": "Đội Trưởng Cẩm Y Thị Vệ",
        "title": "Chương 2: Ngưỡng Vọng Kỳ Đài",
        "text": (
            "Tân khoa dừng bước trình lệnh bài. Trước mắt ngài là Kỳ Đài ba tầng trấn giữ mặt nam Kinh thành "
            "và chín cỗ Cửu Vị Thần Công đúc từ thời Đức Thế Tổ Gia Long. "
            "Hãy chứng tỏ kiến thức về đài cờ kinh đô trước khi tiến đến cửa Ngọ Môn."
        ),
    },
    {
        "id": "quest_03_intro",
        "category": "quest",
        "quest_id": "Q03",
        "profile": "official_male",
        "speaker_override": "Thị Vệ Trực Ngọ Môn",
        "title": "Chương 3: Nghi Lễ Ngọ Môn Quan",
        "text": (
            "Đây là Ngọ Môn Quan, cửa chính nam của Hoàng thành. Phép tắc triều đình cực kỳ nghiêm cẩn: "
            "năm cửa mở dưới Lầu Ngũ Phụng nhưng không phải cửa nào bề tôi cũng được bước qua. "
            "Ngài hãy nêu rõ phép đi qua cửa Ngọ Môn để được điểm chiêng mở lối vào Đại Nội."
        ),
    },
    {
        "id": "quest_04_intro",
        "category": "quest",
        "quest_id": "Q04",
        "profile": "official_male",
        "speaker_override": "Quan Thượng Thư Bộ Lễ",
        "title": "Chương 4: Đại Triều Điện Thái Hòa",
        "text": (
            "Khâm phụng Hoàng Thượng chuẩn ban ân điển! Tân khoa đã bước qua cầu Trung Đạo tới sân Đại Triều Nghi "
            "trước Điện Thái Hòa. Ngước nhìn mái ngói Hoàng lưu ly và tám mươi cột gỗ lim thếp vàng, "
            "ngài hãy hoàn thành câu khảo cứu kiến trúc chính điện để nhận Ấn Đại Triều."
        ),
    },
    {
        "id": "quest_05_intro",
        "category": "quest",
        "quest_id": "Q05",
        "profile": "official_male",
        "speaker_override": "Quan Tự Khanh Thái Thường Tự",
        "title": "Chương 5: Khảo Cứu Cửu Đỉnh",
        "text": (
            "Nơi sân Thế Tổ Miếu và Hiển Lâm Các này hội tụ chín đỉnh đồng Cửu Đỉnh thiêng liêng của quốc gia, "
            "mỗi đỉnh ứng với miếu hiệu một bậc đế vương nhà Nguyễn. "
            "Tân khoa hãy giải đáp bí ẩn trên thân đỉnh đồng để thỉnh tiếng Đại Hồng Chung."
        ),
    },
    {
        "id": "quest_06_intro",
        "category": "quest",
        "quest_id": "Q06",
        "profile": "official_male",
        "speaker_override": "Nhạc Quan Thanh Bình Thự",
        "title": "Chương 6: Thưởng Âm Duyệt Thị Đường",
        "text": (
            "Hoan nghênh tân khoa tiến vào Duyệt Thị Đường trong Tử Cấm Thành. "
            "Sau buổi đại triều, triều đình mở tiệc ban yến và tấu khúc Đăng Đàn Cung tại nhà hát cổ này. "
            "Hãy trả lời câu hỏi về âm nhạc cung đình để lĩnh Ấn Thanh Bình Nhã Nhạc."
        ),
    },
    {
        "id": "quest_07_intro",
        "category": "quest",
        "quest_id": "Q07",
        "profile": "official_male",
        "speaker_override": "Quan Hàn Lâm Viện Biên Tu",
        "title": "Chương 7: Mật Điển Tàng Thư Lâu",
        "text": (
            "Ngài đã tới đích cuối tại Tàng Thư Lâu giữa hồ Học Hải. Mọi châu bản ngự phê và quốc sử Đại Nam "
            "đều được gìn giữ giữa bốn bề mặt nước nơi đây. Hãy giải đáp câu hỏi cuối cùng để lưu danh "
            "vào sổ vàng Hàn Lâm Viện."
        ),
    },
    {
        "id": "quest_complete",
        "category": "quest",
        "quest_id": "COMPLETE",
        "profile": "official_male",
        "speaker_override": "Thượng Thư Nội Các",
        "title": "Hoàn Tất Sứ Mệnh Khâm Sai Bác Cổ",
        "text": (
            "Khâm thử! Tân khoa đã thu thập trọn vẹn bảy đạo Ấn triện Hoàng cung từ bến sông Hương qua Ngọ Môn, "
            "Điện Thái Hòa, Thế Tổ Miếu, Duyệt Thị Đường đến Tàng Thư Lâu. Triều đình chính thức sắc phong ngài "
            "danh hiệu Khâm Sai Bác Cổ Đại Thần năm Tự Đức thứ ba mươi ba!"
        ),
    },
]


def probe_duration_sec(mp3_path: pathlib.Path) -> float:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(mp3_path),
            ],
            text=True,
        ).strip()
        return round(float(out), 2)
    except Exception:
        return 0.0


async def synthesize_one(entry: dict, sem: asyncio.Semaphore) -> dict:
    prof = VOICE_PROFILES[entry["profile"]]
    out_file = VOICE_DIR / f"{entry['id']}.mp3"
    async with sem:
        comm = edge_tts.Communicate(
            text=entry["text"],
            voice=prof["voice"],
            rate=prof["rate"],
            pitch=prof["pitch"],
        )
        await comm.save(str(out_file))

    data = out_file.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    dur = probe_duration_sec(out_file)
    return {
        "id": entry["id"],
        "category": entry["category"],
        "tile_ids": entry.get("tile_ids", []),
        "quest_id": entry.get("quest_id"),
        "speaker": entry.get("speaker_override") or prof["speaker_label"],
        "voice_model": prof["voice"],
        "title": entry["title"],
        "text": entry["text"],
        "url": f"./assets/voice/{out_file.name}",
        "bytes": len(data),
        "duration_sec": dur,
        "sha256_12": sha[:12],
    }


async def main() -> None:
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(4)
    items = await asyncio.gather(*(synthesize_one(e, sem) for e in VOICE_ENTRIES))
    manifest = {
        "schema": "hue_1880_voice_manifest_v1",
        "generated_utc": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "engine": "Microsoft Edge Neural TTS (Free Static Pre-Generated + Web Speech API Fallback)",
        "voices": VOICE_PROFILES,
        "total_clips": len(items),
        "total_bytes": sum(x["bytes"] for x in items),
        "clips": items,
    }
    manifest_path = VOICE_DIR / "voice_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"[VOICE_GEN] Generated {len(items)} Neural Vietnamese MP3 clips "
        f"({manifest['total_bytes'] / 1024:.1f} KB total) -> {manifest_path}"
    )


if __name__ == "__main__":
    asyncio.run(main())
