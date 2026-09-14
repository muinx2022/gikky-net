#!/usr/bin/env python3
"""Gắn watermark 'gikky.net' ở góc phải dưới của hình ảnh.

Cách dùng:
    python scripts/bai-viet/watermark.py <input_path> [output_path]

Nếu không truyền `output_path`, script sẽ ghi đè lên file nguồn.
"""

import io
import os
import sys
from PIL import Image, ImageDraw, ImageFont


def gan_watermark(
    duong_dan_vao: str,
    duong_dan_ra: str | None = None,
    text: str = "gikky.net",
) -> str:
    if not os.path.exists(duong_dan_vao):
        raise FileNotFoundError(f"Không tìm thấy file: {duong_dan_vao}")

    if duong_dan_ra is None:
        duong_dan_ra = duong_dan_vao

    with open(duong_dan_vao, "rb") as f:
        raw_bytes = f.read()

    img = Image.open(io.BytesIO(raw_bytes))
    orig_format = img.format or "PNG"
    orig_mode = img.mode

    im_rgba = img.convert("RGBA")
    overlay = Image.new("RGBA", im_rgba.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    w, h = im_rgba.size
    font_size = max(13, min(int(h * 0.028), 32))
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size
            )
        except Exception:
            try:
                font = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size
                )
            except Exception:
                font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    padding_x = int(font_size * 0.55)
    padding_y = int(font_size * 0.3)
    margin = int(font_size * 0.75)

    box_w = text_w + padding_x * 2
    box_h = text_h + padding_y * 2

    box_x = w - box_w - margin
    box_y = h - box_h - margin

    draw.rounded_rectangle(
        [box_x, box_y, box_x + box_w, box_y + box_h],
        radius=max(3, int(box_h * 0.25)),
        fill=(15, 15, 15, 150),
        outline=(255, 255, 255, 35),
        width=1,
    )

    text_x = box_x + padding_x
    text_y = box_y + padding_y
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 230), font=font)

    watermarked = Image.alpha_composite(im_rgba, overlay)

    if orig_mode in ("RGB", "L") or orig_format == "JPEG":
        watermarked.convert("RGB").save(duong_dan_ra, format="JPEG", quality=92)
    else:
        watermarked.save(duong_dan_ra, format=orig_format)

    return duong_dan_ra


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Cách dùng: python scripts/bai-viet/watermark.py <input_path> [output_path]")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else None
    ket_qua = gan_watermark(inp, out)
    print(f"Đã gắn watermark gikky.net thành công vào: {ket_qua}")
