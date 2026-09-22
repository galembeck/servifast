import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {},
	server: {
		PORT: z.coerce.number().default(3333),

		DATABASE_URL: z.url(),

		JWT_SECRET: z.string(),

		RESEND_API_KEY: z.string().optional(),

		RESEND_FROM_EMAIL: z.email().default("onboarding@resend.dev"),

		WEB_URL: z.url().default("http://localhost:3000"),
	},
	shared: {
		NEXT_PUBLIC_API_URL: z.url().optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,

		PORT: process.env.PORT,

		DATABASE_URL: process.env.DATABASE_URL,

		JWT_SECRET: process.env.JWT_SECRET,

		RESEND_API_KEY: process.env.RESEND_API_KEY,

		RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

		WEB_URL: process.env.WEB_URL,
	},
	emptyStringAsUndefined: true,
});
