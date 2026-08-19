"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

const quickSteps = [
  { step: "১", where: "K50A মেশিন", action: "Fingerprint নিন + User ID দিন (যেমন 1001)" },
  { step: "২", where: "People (ওয়েব)", action: "নাম, ফোন, বিভাগ + K50A User ID = 1001 (একই নম্বর)" },
  { step: "৩", where: "K50A Devices", action: "Read users → 1001 আছে কিনা দেখুন" },
  { step: "৪", where: "Scan / Sync", action: "আঙুল দিন → Sync now → Dashboard-এ নাম আসে" },
];

const wrongVsRight = [
  { wrong: "People-এ add করলেই K50A জানে", right: "K50A-তে আলাদা enroll করতে হবে" },
  { wrong: "ওয়েব থেকে fingerprint দেওয়া যায়", right: "Fingerprint শুধু K50A-তে" },
  { wrong: "নাম মিললেই চলবে", right: "K50A User ID নম্বর মিলতে হবে" },
];

const sections = [
  {
    title: "১. K50A ডিভাইস অফিস নেটওয়ার্কে সংযোগ",
    body: [
      "K50A Ethernet কেবল দিয়ে অফিস রাউটার/সুইচ-এ লাগান।",
      "K50A মেনু → TCP/IP: Static IP (যেমন 192.168.1.201), Port (4370), Gateway, Subnet Mask।",
      "একই LAN-এ PC থেকে: ping 192.168.1.201",
      "K50A TCP পোর্ট ইন্টারনেটে খুলবেন না — শুধু অফিস LAN বা VPN।",
    ],
  },
  {
    title: "২. ওয়েবসাইটে K50A যোগ করা",
    body: [
      "লগইন → K50A Devices → Add device",
      "Name: K50A-001, IP: ডিভাইসের IP, Port: 4370",
      "Adapter: k50a (আসল) / mock (টেস্ট)",
      "Save → Test connection → Get info / Read users / Sync now",
    ],
  },
  {
    title: "৩. Fingerprint — শুধু K50A-তে (ওয়েবে নয়)",
    body: [
      "K50A মেনু → User Management → New User",
      "User ID দিন (1001, 1002 …) — এটাই K50A User ID",
      "Enroll Fingerprint — ২–৩ বার আঙুল রাখুন",
      "ওয়েবসাইট থেকে fingerprint এনরোল করা যায় না (নিরাপত্তা)",
    ],
  },
  {
    title: "৪. ওয়েবসাইটে কর্মচারী (People)",
    body: [
      "People → Add employee",
      "Code, Name, Phone, Department, Designation দিন",
      "K50A User ID = K50A-তে দেওয়া User ID (হুবহু একই)",
      "Create — এখন scan করলে ওই কর্মচারী চেনা যাবে",
      "Edit / Deactivate: তালিকায় নামে ক্লিক",
    ],
  },
  {
    title: "৫. উপস্থিতি কীভাবে আসে",
    body: [
      "কর্মচারী K50A-তে scan → মেশিনে লগ save",
      "Worker (পোর্ট 3001) বা Sync now → Neon DB",
      "deviceUserId (1001) দিয়ে People-এ employee match",
      "Dashboard live feed + Attendance daily register update",
    ],
  },
  {
    title: "৬. দৈনিক রেজিস্টার (Attendance)",
    body: [
      "তারিখ ফিল্টার → Apply",
      "ADMIN: Edit / Delete / Add entry",
      "VIEWER: শুধু দেখতে পারে",
    ],
  },
  {
    title: "৭. অ্যাডমিন ও Role",
    body: [
      "লগইন: .env → ADMIN_BOOTSTRAP_EMAIL / PASSWORD",
      "পাসওয়ার্ড: My account → Change password",
      "SUPER_ADMIN / ADMIN: সব manage | VIEWER: শুধু দেখা",
    ],
  },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader
        eyebrow="সহায়তা"
        title="বাংলা ব্যবহার নির্দেশিকা"
        description="K50A ও ওয়েবসাইট কীভাবে কাজ করে — সহজ বাংলায়"
      />

      <Card className="mb-6 border-teal/40 bg-teal/5">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-teal">⭐ সবচেয়ে গুরুত্বপূর্ণ প্রশ্ন</h2>
            <p className="mt-2 text-sm leading-relaxed">
              <strong>People-এ employee add করলে K50A কীভাবে জানে?</strong>
              <br />
              <strong>উত্তর: জানে না।</strong> ওয়েবসাইট K50A-তে কাউকে পাঠায় না। আপনি K50A-তে fingerprint
              enroll করবেন, তারপর ওয়েবসাইটে <strong>একই User ID নম্বর</strong> দিয়ে employee যোগ করবেন।
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quickSteps.map((item) => (
              <div key={item.step} className="rounded-lg border border-line bg-paper p-3 text-sm">
                <div className="mb-1 font-semibold text-teal">ধাপ {item.step}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{item.where}</div>
                <div className="mt-1 leading-relaxed">{item.action}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="py-2 pr-4">❌ ভুল ধারণা</th>
                  <th className="py-2">✅ সত্যি</th>
                </tr>
              </thead>
              <tbody>
                {wrongVsRight.map((row) => (
                  <tr key={row.wrong} className="border-b border-line/60">
                    <td className="py-2 pr-4 text-muted">{row.wrong}</td>
                    <td className="py-2">{row.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-5">
              <h2 className="mb-3 font-semibold text-teal">{section.title}</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink">
                {section.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="p-5 text-sm text-muted">
          বিস্তারিত markdown গাইড: <code className="rounded bg-paper px-1">docs/BANGLA-GUIDE.md</code>
        </CardContent>
      </Card>
    </div>
  );
}
