import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatWhatsAppNumber,
  buildWhatsAppMessage,
  buildWhatsAppLink,
} from "../frontend/src/utils/whatsapp.js";

test("Indian WhatsApp numbers are normalized once, including already-prefixed records", () => {
  for (const input of [
    "9876543210",
    "919876543210",
    "+91 98765-43210",
    "0091 (98765) 43210",
    "(98765) 43210",
    9876543210,
  ])
    assert.equal(formatWhatsAppNumber(input), "919876543210");
  for (const input of [
    "",
    null,
    undefined,
    "12345",
    "1234567890",
    "+1 9876543210",
    "+9876543210",
    "91919876543210",
    "9876543210abc",
    "9876543210?text=spam",
    "9876543210.0",
  ])
    assert.throws(() => formatWhatsAppNumber(input), /Invalid mobile number/);
});

const player = { name: "Asha & Ravi + हिंदी", phone: "+91 9876543210" };
const tournament = { name: "Synthetic Memorial Tournament", season: 3 };
test("approval uses the actual name, tournament and saved India-time auction date", () => {
  const options = {
    player,
    tournament,
    status: "approved",
    auctionDate: "2026-12-23",
  };
  const message = buildWhatsAppMessage(options);
  assert(message.includes(player.name));
  assert(message.includes("Synthetic Memorial Tournament — Season 3"));
  assert(message.includes("23 December 2026"));
  assert(message.includes("team owner"));
  const link = buildWhatsAppLink(options);
  assert(link.startsWith("https://wa.me/919876543210?text="));
  assert(link.includes("%26"));
  assert.equal(new URL(link).searchParams.get("text"), message);
});

test("unset auction dates are explicit and invalid dates cannot generate an approval link", () => {
  assert.match(
    buildWhatsAppMessage({ player, tournament, status: "approved" }),
    /Jald announce ki jayegi/,
  );
  for (const auctionDate of ["2026-02-30", "2026-13-01", "tomorrow"])
    assert.throws(
      () =>
        buildWhatsAppLink({
          player,
          tournament,
          status: "approved",
          auctionDate,
        }),
      /auction date is invalid/,
    );
});

test("rejection requests a proper screenshot and invalid numbers or message kinds cannot produce links", () => {
  const options = { player, tournament, status: "rejected" };
  assert.match(
    buildWhatsAppMessage(options),
    /payment receive\/verify nahi hua/,
  );
  assert.match(buildWhatsAppMessage(options), /readable payment screenshot/);
  assert(!buildWhatsAppMessage(options).includes("Auction date"));
  assert.throws(
    () =>
      buildWhatsAppLink({ ...options, player: { ...player, phone: "bad" } }),
    /Invalid mobile/,
  );
  assert.throws(
    () => buildWhatsAppLink({ ...options, status: "pending" }),
    /Select Registration/,
  );
});
