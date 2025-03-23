import {
  List,
  Icon,
  ActionPanel,
  Action,
  Clipboard,
  Detail,
  useNavigation,
  showHUD,
  Grid,
  openCommandPreferences,
  LocalStorage,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import ExifReader from "exifreader";
import fs from "fs/promises";
import os from "os";
import dayjs from "dayjs";
import { Jimp } from "jimp";
import { basename } from "path";
import { existsSync } from "fs";
import { useState } from "react";

const tmpDir = os.tmpdir();
const clipboardPath = os.homedir() + "/Library/Caches/com.raycast.macos/Clipboard";

type ImageInfo = {
  name: string;
  path: string;
  time: Date;
  size: number;
};

async function getImageMetadata(file: string) {
  const buff = await fs.readFile(file);
  const tags = ExifReader.load(buff, { includeUnknown: true });
  return tags;
}

async function pasteCompressedImage(
  inputPath: string,
  options: {
    quality?: number;
    extension?: "jpeg" | "png";
    recompress?: boolean;
  },
) {
  try {
    const { quality = 80, extension = "jpeg", recompress = false } = options;
    console.log(inputPath);
    const inputSize = await fs.stat(inputPath);
    const outputPath: `${string}.${typeof extension}` = `${tmpDir}/${basename(inputPath)}-${quality}.${extension}`;
    console.log(outputPath);
    if (!existsSync(outputPath) || recompress) {
      console.log(outputPath);
      const image = await Jimp.read(inputPath);
      await image.write(outputPath, { quality: quality / 100 });
      console.log("New Buffer");
    } else {
      console.log("Old Buffer");
    }
    await Clipboard.paste({ file: outputPath });

    const outputSize = await fs.stat(outputPath);
    const ratio = (inputSize.size / outputSize.size) * 100;
    console.log(`Compressed: ${ratio.toFixed(2)}%, ${formatBytes(outputSize.size)}`);
    showHUD(`Compressed: ${ratio.toFixed(2)}%, ${formatBytes(outputSize.size)}`);

    console.log("Success");
    return outputPath;
  } catch (err) {
    console.error("Failed:", err);
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function ImageDetail({ image }: { image: ImageInfo }) {
  const { path, size } = image;
  const markdown = `![](${path}?raycast-height=354)`;

  const { isLoading, data: metadata } = usePromise(() => {
    return getImageMetadata(path)
      .then((metadata) => {
        console.log(metadata);
        return metadata;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
  });
  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        metadata && (
          <List.Item.Detail.Metadata>
            <List.Item.Detail.Metadata.Label
              title="Dimensions"
              text={`${metadata["Image Width"]?.value}x${metadata["Image Height"]?.value}`}
            />
            <Detail.Metadata.TagList title="Image Type">
              <Detail.Metadata.TagList.Item text={metadata["FileType"]?.value} />
            </Detail.Metadata.TagList>
            <List.Item.Detail.Metadata.Label title="Compression" text={`${metadata["Compression"]?.value}`} />
            <List.Item.Detail.Metadata.Separator />
            <List.Item.Detail.Metadata.Label title="Size" text={`${formatBytes(size)}`} />
          </List.Item.Detail.Metadata>
        )
      }
    />
  );
}

function ActionList({
  image,
  switchView,
  currentView,
}: {
  image: ImageInfo;
  switchView: () => void;
  currentView: "grid" | "list";
}) {
  const { push } = useNavigation();
  return (
    <ActionPanel>
      <Action title="Paste Compressed" icon={Icon.Image} onAction={() => pasteCompressedImage(image.path, {})} />
      <Action
        title="Show Detail"
        icon={Icon.Image}
        onAction={() => {
          push(<ImageDetail image={image} />);
        }}
      />
      <Action
        title={currentView === "grid" ? "List View" : "Grid View"}
        shortcut={{ modifiers: ["cmd"], key: currentView === "grid" ? "l" : "g" }}
        icon={currentView === "grid" ? Icon.List : Icon.PlusSquare}
        onAction={() => {
          switchView();
        }}
      />
      <Action.ToggleQuickLook />
      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openCommandPreferences} />
      <Action
        title="Recompress"
        icon={Icon.Box}
        onAction={() => pasteCompressedImage(image.path, { recompress: true })}
      />
    </ActionPanel>
  );
}

function ImageList({
  images,
  isLoading,
  switchView,
}: {
  images: ImageInfo[];
  isLoading: boolean;
  switchView: () => void;
}) {
  return (
    <List isLoading={isLoading} isShowingDetail={true}>
      {images?.map((image) => (
        <List.Item
          key={image.name}
          title={dayjs(image.time).format("MM-DD HH:mm")}
          quickLook={{ path: image.path }}
          icon={image.path}
          accessories={[
            {
              text: formatBytes(image.size),
            },
          ]}
          actions={<ActionList currentView={"list"} image={image} switchView={switchView} />}
          detail={<List.Item.Detail markdown={`![](${image.path}?raycast-height=354)`} />}
        />
      ))}
    </List>
  );
}

function ImageGrid({
  images,
  isLoading,
  switchView,
}: {
  images: ImageInfo[];
  isLoading: boolean;
  switchView: () => void;
}) {
  return (
    <Grid isLoading={isLoading} columns={3}>
      {images?.map((image) => (
        <Grid.Item
          key={image.name}
          title={dayjs(image.time).format("MM-DD HH:mm:ss") + `  (${formatBytes(image.size)})`}
          quickLook={{ path: image.path }}
          content={image.path}
          actions={<ActionList currentView={"grid"} image={image} switchView={switchView} />}
        />
      ))}
    </Grid>
  );
}

export default function Command() {
  const { isLoading, data: clipboardImages } = usePromise(async () => {
    const images = await fs.readdir(clipboardPath);
    const imageInfos = (
      await Promise.all(
        images.map(async (image) => {
          const imageInfo = await fs.stat(`${clipboardPath}/${image}`);
          return {
            name: image,
            path: `${clipboardPath}/${image}`,
            time: imageInfo.mtime,
            size: imageInfo.size,
          };
        }),
      )
    )
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 100);
    return imageInfos;
  }, []);

  const [view, setView] = useState<"grid" | "list" | undefined>(undefined);
  LocalStorage.getItem("view").then((localView) => {
    console.log("read localView", localView);
    if (!localView) {
      LocalStorage.setItem("view", "grid");
      console.log("set localView", "grid");
    }
    setView(localView as "grid" | "list");
    console.log(view, "view");
  });

  return view === "grid" ? (
    <ImageGrid
      images={clipboardImages ?? []}
      isLoading={isLoading}
      switchView={() => {
        setView("list");
        LocalStorage.setItem("view", "list");
      }}
    />
  ) : (
    <ImageList
      images={clipboardImages ?? []}
      isLoading={isLoading}
      switchView={() => {
        setView("grid");
        LocalStorage.setItem("view", "grid");
      }}
    />
  );
}
