import { relative, resolve, sep } from "node:path";

export function createReleaseTreeCopyOptions(sourceRoot: string) {
  const resolvedSourceRoot = resolve(sourceRoot);

  return {
    recursive: true,
    filter: (source: string) => {
      const relativeSource = relative(resolvedSourceRoot, resolve(source));
      return relativeSource === "" || !relativeSource.split(sep).includes(".tmp");
    }
  } as const;
}
