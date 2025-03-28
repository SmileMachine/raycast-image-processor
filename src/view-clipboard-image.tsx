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
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import fs from "fs/promises";
import os from "os";
import dayjs from "dayjs";
import { Jimp } from "jimp";
import { existsSync } from "fs";
import { useState } from "react";
import { getOutputPath, formatBytes, ImageInfo, getImageInfo } from "./utils";
import { ImageDetail } from "./image-detail";

const clipboardPath = os.homedir() + "/Library/Caches/com.raycast.macos/Clipboard";

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
    const outputPath = getOutputPath(inputPath, { quality, extension });
    console.log(outputPath);
    if (!existsSync(outputPath) || recompress) {
      console.log(outputPath);
      const image = await Jimp.read(inputPath);
      await image.write(outputPath, { quality: quality });
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
