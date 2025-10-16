import crypto from "crypto";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { generateToken } from "./jwt";
import { z } from "zod";
import { generateReferralCode } from "./referral";
import { getNextResetTime } from "./energy";

const TelegramLoginInput = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.string(),
  hash: z.string(),
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED_SKEW_SECONDS = Number(process.env.LOGIN_ALLOWED_SKEW_SECONDS || "86400"); // 24 hours

function verifyTelegramLoginHash(data: Record<string, string>): boolean {
  // Telegram Login Widget uses: secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  
  // Build data_check_string from sorted keys (excluding hash)
  const dataCheckString = Object.keys(data)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");
  
  // Compute HMAC-SHA256
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  
  return hmac === data.hash;
}

export async function handleTelegramLoginWidget(req: Request, res: Response) {
  try {
    const parsed = TelegramLoginInput.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid input data" 
      });
    }
    
    const loginData = parsed.data;
    
    // Check auth_date (prevent replay attacks)
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authSeconds = Number(loginData.auth_date);
    
    if (!Number.isFinite(authSeconds) || Math.abs(nowSeconds - authSeconds) > ALLOWED_SKEW_SECONDS) {
      return res.status(401).json({ 
        ok: false, 
        error: "Authentication expired" 
      });
    }
    
    // Verify hash signature
    const dataAsStrings = Object.fromEntries(
      Object.entries(loginData).map(([k, v]) => [k, String(v)])
    );
    
    if (!verifyTelegramLoginHash(dataAsStrings)) {
      return res.status(401).json({ 
        ok: false, 
        error: "Invalid signature" 
      });
    }
    
    // Get or create user
    const tgId = String(loginData.id);
    let user = await storage.getUserByTgId(tgId);
    
    if (!user) {
      // Create new user (will need to complete registration in Mini App)
      const name = [loginData.first_name, loginData.last_name]
        .filter(Boolean)
        .join(" ") || loginData.username || "User";
      
      const referralCode = generateReferralCode();
      
      user = await storage.createUser({
        tgId,
        username: loginData.username || null,
        name,
        gender: "other", // Will be set during Mini App registration
        age: 18, // Placeholder, will be updated
        birthdayDate: new Date(0), // Placeholder
        birthTime: null,
        birthPlace: null,
        timezone: "Europe/Moscow",
        referralCode,
      });
      
      // Set initial energy
      await storage.updateUser(user.id, {
        energy: 10,
        energyResetAt: getNextResetTime("Europe/Moscow"),
      });
      
      // Refetch user with energy fields
      user = await storage.getUser(user.id) || user;
    } else {
      // Update username if changed
      if (loginData.username && user.username !== loginData.username) {
        await storage.updateUser(user.id, {
          username: loginData.username,
        });
        user = await storage.getUser(user.id) || user;
      }
    }
    
    // Generate JWT token
    const token = generateToken(user.id);
    
    res.json({ 
      ok: true, 
      data: { 
        user, 
        token 
      } 
    });
  } catch (error: any) {
    console.error("Telegram Login Widget error:", error);
    res.status(500).json({ 
      ok: false, 
      error: error.message || "Internal server error" 
    });
  }
}
