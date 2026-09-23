import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "menu-items");

export async function saveMenuItemImage(image: MultipartFile): Promise<string> {
	const extension = path.extname(image.filename);
	const fileName = `${randomUUID()}${extension}`;

	await mkdir(UPLOADS_DIR, { recursive: true });
	await pipeline(
		image.file,
		createWriteStream(path.join(UPLOADS_DIR, fileName))
	);

	return `/uploads/menu-items/${fileName}`;
}

export async function deleteMenuItemImage(imageUrl: string): Promise<void> {
	const filePath = path.join(process.cwd(), imageUrl);

	try {
		await unlink(filePath);
	} catch {
		// Image file already missing on disk; nothing to clean up.
	}
}
