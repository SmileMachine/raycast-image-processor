import { Icon, useNavigation, ActionPanel, Action, Detail } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { existsSync } from "fs";
import { getImageMetadata, getOutputPath, getImageInfo, formatBytes, ImageInfo } from "./utils";
export function ImageDetail({ image }: { image: ImageInfo }) {
  const { push } = useNavigation();
  const { path, size } = image;
  const markdown = `![](${path}?raycast-height=354)`;

  const { isLoading, data: { metadata, compressedInfo } = {} } = usePromise(async () => {
    const compressedInfo = await (async () => {
      const compressedImagePath = getOutputPath(path, { quality: 80, extension: "jpeg" });
      if (!existsSync(compressedImagePath)) {
        return null;
      }
      return getImageInfo(compressedImagePath);
    })();
    const metadata = await getImageMetadata(path)
      .then((metadata) => {
        return metadata;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
    return { metadata, compressedInfo };
  });

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        metadata && (
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Dimensions"
              text={`${metadata["Image Width"]?.value}x${metadata["Image Height"]?.value}`}
            />
            <Detail.Metadata.TagList title="Image Type">
              <Detail.Metadata.TagList.Item text={metadata["FileType"]?.value} />
            </Detail.Metadata.TagList>
            {compressedInfo && (
              <Detail.Metadata.Label
                title="Compressed Size"
                text={`${formatBytes(compressedInfo.size)} (${((compressedInfo.size / size) * 100).toFixed(2)}%)`}
              />
            )}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label title="Size" text={`${formatBytes(size)}`} />
            <Detail.Metadata.Label title="Path" text={path} />
            <Detail.Metadata.Link
              title="Open in Finder"
              text={"Link"}
              target={`file://${path.replace(image.name, "")}`}
            />
          </Detail.Metadata>
        )
      }
      actions={
        <ActionPanel>
          <Action.ShowInFinder path={path} />
          {compressedInfo && (
            <Action
              title="Show Compressed Detail"
              icon={Icon.Image}
              onAction={() => {
                push(<ImageDetail image={compressedInfo} />);
              }}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
