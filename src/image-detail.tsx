import { Icon, useNavigation, ActionPanel, Action, Detail, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { existsSync } from "fs";
import { getImageMetadata, getOutputPath, getImageInfo, formatBytes, ImageInfo } from "./utils";
export function ImageDetail({ image }: { image: ImageInfo }) {
  const { push } = useNavigation();
  const { path, size } = image;
  const markdown = `![](${path}?raycast-height=354)`;

  const { isLoading, data: { metadata, compressedImageInfo } = {} } = usePromise(async () => {
    const compressedImageInfo = await (async () => {
      const compressedImagePath = getOutputPath(path, { quality: 80, extension: "jpeg" });
      if (!existsSync(compressedImagePath)) {
        return image;
      }
      return getImageInfo(compressedImagePath);
    })();
    const metadata = await getImageMetadata(path)
      .then((metadata) => {
        console.log(metadata);
        return metadata;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
    return { metadata, compressedImageInfo };
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
            <List.Item.Detail.Metadata.Link title="Path" text={`${path}`} target={`finder://${path}`} />
          </List.Item.Detail.Metadata>
        )
      }
      actions={
        compressedImageInfo &&
        compressedImageInfo.size < size && (
          <ActionPanel>
            <Action
              title="Show Compressed Detail"
              icon={Icon.Image}
              onAction={() => {
                push(<ImageDetail image={compressedImageInfo} />);
              }}
            />
          </ActionPanel>
        )
      }
    />
  );
}
