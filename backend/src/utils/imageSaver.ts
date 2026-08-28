import fs from 'fs';
import path from 'path';

export const saveAvatar = (base64String: string | undefined): string => {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String || '';
  }

  try {
    const matches = base64String.match(/^data:image\/([A-Za-z+-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64String;
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Use timestamp + random suffix for filename (multer style)
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    // Return relative path only — frontend will prepend API base URL
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('[Avatar Save Error]:', err);
    return base64String;
  }
};
