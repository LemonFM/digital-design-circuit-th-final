# CPE 2423 ครึ่งหลัง

สรุปเนื้อหาครึ่งหลัง (สอบปลายภาค) วิชา CPE 2423 เป็นเว็บ HTML ล้วน ไม่ต้อง build เปิด `index.html` ได้ทันที

## หัวข้อ

อ้างอิงสไลด์ *06 Introduction to Latches and Flip-Flops*

1. [SR Latch & SR Flip-Flop](topics/sr-flipflop.html)
2. [D Latch & D Flip-Flop](topics/d-flipflop.html)
3. [JK Flip-Flop](topics/jk-flipflop.html)
4. [T Flip-Flop](topics/t-flipflop.html)
5. [Asynchronous Inputs (Preset / Clear)](topics/async-inputs.html)
6. [Register & Shift Register](topics/shift-registers.html)

## แท็บ

- [เนื้อหา](index.html): รายการหัวข้อ
- [สรุป](summary.html): ตาราง สมการ excitation และวิธีคิดทั้งบทในหน้าเดียว
- [แนวข้อสอบ](exam.html): แท็บย่อย ปรนัย (เลือกคำตอบ + ถูก/ผิด) / อัตนัย (เติมตาราง, timing diagram, เขียนตอบ/ออกแบบ) แยกตามเรื่อง ลิงก์ตรงได้ เช่น `exam.html#sub-dj`

## โครงสร้าง

```
index.html            แท็บเนื้อหา (รายการหัวข้อ)
summary.html          แท็บสรุป
exam.html             แท็บแนวข้อสอบ
topics/*.html         หนึ่งไฟล์ต่อหนึ่งหัวข้อ
assets/style.css      สไตล์ที่ใช้ร่วมกัน (light mode)
assets/logic-kit.js   ตัวช่วยวาดวงจร, timing diagram และลอจิก 3 ค่า (0/1/?)
```

## เพิ่มหัวข้อใหม่

1. คัดลอก `topics/sr-flipflop.html` เป็นไฟล์ใหม่ใน `topics/` แล้วแก้เนื้อหา
2. เพิ่มรายการใน `<ol class="topic-list">` ของ `index.html`

## เผยแพร่ด้วย GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → เลือก branch `main` และโฟลเดอร์ `/ (root)`
# digital-design-circuit-th-final
