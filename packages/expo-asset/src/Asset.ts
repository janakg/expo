import { Platform } from 'expo-core';
import { FileSystem } from 'expo-file-system';
import { getAssetByID } from 'react-native/Libraries/Image/AssetRegistry';
import { setCustomSourceTransformer } from 'react-native/Libraries/Image/resolveAssetSource';

import * as AssetSources from './AssetSources';
import * as AssetUris from './AssetUris';
import * as EmbeddedAssets from './EmbeddedAssets';
import * as ImageAssets from './ImageAssets';

type AssetDescriptor = {
  name: string;
  type: string;
  hash?: string | null;
  uri: string;
  width?: number | null;
  height?: number | null;
};

type DownloadPromiseCallbacks = {
  resolve: () => void;
  reject: (error: Error) => void;
};

export type AssetMetadata = AssetSources.AssetMetadata;

export class Asset {
  static byHash = {};
  static byUri = {};

  name: string;
  type: string;
  hash: string | null = null;
  uri: string;
  localUri: string | null = null;
  width: number | null = null;
  height: number | null = null;
  downloading: boolean = false;
  downloaded: boolean = false;
  _downloadCallbacks: DownloadPromiseCallbacks[] = [];

  constructor({ name, type, hash = null, uri, width, height }: AssetDescriptor) {
    this.name = name;
    this.type = type;
    this.hash = hash;
    this.uri = uri;

    if (typeof width === 'number') {
      this.width = width;
    }
    if (typeof height === 'number') {
      this.height = height;
    }

    if (hash) {
      this.localUri = EmbeddedAssets.getEmbeddedAssetUri(hash, type);
      if (this.localUri) {
        this.downloaded = true;
      }
    }
  }

  static loadAsync(moduleId: number | number[]): Promise<void[]> {
    const moduleIds = Array.isArray(moduleId) ? moduleId : [moduleId];
    return Promise.all(moduleIds.map(moduleId => Asset.fromModule(moduleId).downloadAsync()));
  }

  static fromModule(virtualAssetModule: number | string): Asset {
    if (typeof virtualAssetModule === 'string') {
      return Asset.fromURI(virtualAssetModule);
    }
  
    const meta = getAssetByID(virtualAssetModule);
    if (!meta) {
      throw new Error(`Module "${virtualAssetModule}" is missing from the asset registry`);
    }
    return Asset.fromMetadata(meta);
  }

  static fromMetadata(meta: AssetMetadata): Asset {
    // The hash of the whole asset, not to be confused with the hash of a specific file returned
    // from `selectAssetSource`
    const metaHash = meta.hash;
    if (Asset.byHash[metaHash]) {
      return Asset.byHash[metaHash];
    }

    const { uri, hash } = AssetSources.selectAssetSource(meta);
    const asset = new Asset({
      name: meta.name,
      type: meta.type,
      hash,
      uri,
      width: meta.width,
      height: meta.height,
    });
    Asset.byHash[metaHash] = asset;
    return asset;
  }

  static fromURI(uri: string): Asset {
    if (Asset.byUri[uri]) {
      return Asset.byUri[uri];
    }

    // Possibly a Base64-encoded URI
    let type = '';
    if (uri.indexOf(';base64') > -1) {
      type = uri.split(';')[0].split('/')[1];
    } else {
      const extension = AssetUris.getFileExtension(uri);
      type = extension.startsWith('.') ? extension.substring(1) : extension;
    }

    const asset = new Asset({
      name: '',
      type,
      uri,
    });

    Asset.byUri[uri] = asset;

    return asset;
  }

  async downloadAsync(): Promise<void> {
    if (this.downloaded) {
      return;
    }
    if (this.downloading) {
      await new Promise((resolve, reject) => {
        this._downloadCallbacks.push({ resolve, reject });
      });
      return;
    }
    this.downloading = true;

    try {
      if (Platform.OS === 'web') {
        if (ImageAssets.isImageType(this.type)) {
          const { width, height, name } = await ImageAssets.getImageInfoAsync(this.uri);
          this.width = width;
          this.height = height;
          this.name = name;
        } else {
          this.name = AssetUris.getFilename(this.uri);
        }
        this.localUri = this.uri;
      } else {
        const localUri = `${FileSystem.cacheDirectory}ExponentAsset-${this.hash}.${this.type}`;
        let { exists, md5 } = await FileSystem.getInfoAsync(localUri, {
          cache: true,
          md5: true,
        });
        if (!exists || md5 !== this.hash) {
          ({ md5 } = await FileSystem.downloadAsync(this.uri, localUri, {
            cache: true,
            md5: true,
          }));
          if (md5 !== this.hash) {
            throw new Error(
              `Downloaded file for asset '${this.name}.${this.type}' ` +
                `Located at ${this.uri} ` +
                `failed MD5 integrity check`
            );
          }
        }

        this.localUri = localUri;
      }
      this.downloaded = true;
      this._downloadCallbacks.forEach(({ resolve }) => resolve());
    } catch (e) {
      this._downloadCallbacks.forEach(({ reject }) => reject(e));
      throw e;
    } finally {
      this.downloading = false;
      this._downloadCallbacks = [];
    }
  }
}

// Override React Native's asset resolution for `Image` components
setCustomSourceTransformer(resolver => {
  const asset = Asset.fromMetadata(resolver.asset);
  return resolver.fromSource(asset.downloaded ? asset.localUri! : asset.uri);
});
