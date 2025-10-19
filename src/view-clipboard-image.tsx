import {
  List,
  Icon,
  ActionPanel,
  Action,
  Clipboard,
  useNavigation,
  showHUD,
  Grid,
  openCommandPreferences,
  LocalStorage,
  showInFinder,
  getPreferenceValues,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import fs from "fs/promises";
import os from "os";
import dayjs from "dayjs";
import { Jimp } from "jimp";
import { existsSync } from "fs";
import { useState } from "react";
import { getOutputPath, formatBytes, ImageInfo, getImageInfo, SupportedExtension } from "./utils";
import { ImageDetail } from "./image-detail";

const clipboardPath = os.homedir() + "/Library/Caches/com.raycast.macos/Clipboard";

async function pasteImage(inputPath: string) {
  await Clipboard.paste({ file: inputPath });
}

async function pasteCompressedImage(
  inputPath: string,
  options: {
    compressOnly?: boolean;
  },
) {
  try {
    const preferences = await getPreferenceValues();
    const qualityString = preferences["save-quality"] as string;
    if (!qualityString.match(/^1?[0-9]{1,2}$/)) {
      showHUD("Please use a valid quality (0-100), current value: " + qualityString);
      return;
    }
    const quality = parseInt(qualityString);
    const extension = preferences["save-extension"] as SupportedExtension;
    console.log("quality: " + quality, "extension: " + extension);
    console.log(preferences);
    const { compressOnly: compressOnly = false } = options;
    console.log(inputPath);
    const inputSize = await fs.stat(inputPath);
    const outputPath = getOutputPath(inputPath, { quality, extension });
    console.log(outputPath);
    if (!existsSync(outputPath) || compressOnly) {
      console.log(outputPath);
      const image = await Jimp.read(inputPath);
      await image.write(outputPath, { quality: quality });
      console.log("New Buffer");
    } else {
      console.log("Old Buffer");
    }
    if (!compressOnly) {
      await Clipboard.paste({ file: outputPath });
    }

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
      <Action title="Paste Original" icon={Icon.Image} onAction={() => pasteImage(image.path)} />
      <Action.ShowInFinder path={image.path} />
      <Action
        title="Show Compressed in Finder"
        icon={Icon.Image}
        onAction={() => {
          const compressedPath = getOutputPath(image.path, { quality: 80, extension: "jpeg" });
          if (existsSync(compressedPath)) {
            showInFinder(compressedPath);
          } else {
            showHUD("Image is not compressed");
          }
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
      <Action
        title="Compress"
        icon={Icon.Box}
        onAction={() => pasteCompressedImage(image.path, { compressOnly: true })}
      />
      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openCommandPreferences} />
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
    const imageInfos = (await Promise.all(images.map((image) => getImageInfo(`${clipboardPath}/${image}`))))
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      // TODO: Pagination
      .slice(0, 100);
    return imageInfos;
  }, []);

  const [view, setView] = useState<"grid" | "list" | undefined>(undefined);
  LocalStorage.getItem("view").then((localView) => {
    if (!localView) {
      LocalStorage.setItem("view", "grid");
      console.log("set localView", "grid");
    }
    setView(localView as "grid" | "list");
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
