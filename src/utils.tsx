import { basename } from "path";
import ExifReader from "exifreader";
import fs from "fs/promises";
import os from "os";

export type ImageInfo = {
  name: string;
  path: string;
  time: Date;
  size: number;
};

export type SupportedExtension = "jpeg" | "png" | "bmp" | "tiff" | "gif";

export function getOutputPath(
  file: string,
  options: { quality: number; extension: SupportedExtension },
): `${string}.${SupportedExtension}` {
  const { quality, extension } = options;
  const tmpDir = os.tmpdir() + "/image-processor";
  fs.mkdir(tmpDir, { recursive: true });
  return `${tmpDir}/${basename(file)}-${quality}.${extension}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export async function getImageMetadata(file: string) {
  const buff = await fs.readFile(file);
  const tags = ExifReader.load(buff, { includeUnknown: true });
  return tags;
}

export function getImageInfo(path: string): Promise<ImageInfo> {
  return fs
    .stat(path)
    .then((stat) => {
      return {
        name: basename(path),
        path: path,
        time: stat.mtime,
        size: stat.size,
      };
    })
    .catch((error) => {
      console.error(error);
      return { name: basename(path), path: path, time: new Date(), size: 0 };
    });
}
