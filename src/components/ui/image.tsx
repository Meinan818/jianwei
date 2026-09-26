'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Utensils } from 'lucide-react';
type ImageFormat = 'jpg' | 'png' | 'webp' | 'bmp' | 'gif' | 'tiff';

type NativeImgProps = React.ComponentPropsWithoutRef<'img'>;

export interface ImageProps extends NativeImgProps {
  quality?: number;
  format?: ImageFormat;
  breakpoints?: Array<number>;
}

const DEFAULT_QUALITY = 80;
const DEFAULT_RESOLUTIONS: number[] = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048,
  3840,
];

const SRC_ALLOWLIST = [
  '/runtime/api/v1/storage/object/',
  '/aily/api/v1/feisuda/attachments/',
  '/aily/api/v1/files/static/',
];

function getClosestResolution(target: number): number {
  return DEFAULT_RESOLUTIONS.reduce((prev, curr) => {
    return Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev;
  });
}

function applyParamsToUrl(
  src: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      return `${k},${v}`;
    })
    .join('/');
  if (!search) return src;

  const [pathAndQuery = '', hash] = src.split('#');
  const [base, query] = pathAndQuery.split('?');
  const urlParams = new URLSearchParams(query);
  urlParams.set('x-tos-process', `image/${search}`);

  return `${base}?${urlParams.toString()}${hash ? '#' + hash : ''}`;
}

function isTargetSrc(originSrc: string) {
  return SRC_ALLOWLIST.some((item) => originSrc.includes(item));
}

function supportWebp() {
  try {
    return (
      document
        .createElement('canvas')
        .toDataURL('image/webp')
        .indexOf('data:image/webp') === 0
    );
  } catch (err) {
    return false;
  }
}

function buildSrcSet(
  src: string,
  widths: number[],
  format: ImageFormat | undefined,
  quality: number,
  width?: number,
  sizes?: string,
): string | undefined {
  if (!widths || widths.length === 0 || (!width && !sizes)) return undefined;
  const fmt = format;
  if (width) {
    return [1, 2]
      .map((dpr) => {
        const targetWidth = getClosestResolution(width * dpr);
        return `${applyParamsToUrl(src, { resize: `w_${targetWidth}`, quality: `Q_${quality}`, format: fmt })} ${dpr}x`;
      })
      .join(', ');
  }
  return widths
    .map(
      (w) =>
        `${applyParamsToUrl(src, { resize: `w_${w}`, quality: `Q_${quality}`, format: fmt })} ${w}w`,
    )
    .join(', ');
}

export const Image = React.forwardRef<HTMLImageElement, ImageProps & { fallbackText?: string }>(
  (
    {
      src,
      width,
      height,
      quality = DEFAULT_QUALITY,
      format,
      sizes,
      srcSet: userSrcSet,
      breakpoints = DEFAULT_RESOLUTIONS,
      className,
      loading = 'lazy',
      decoding = 'async',
      alt,
      fallbackText,
      ...rest
    },
    ref,
  ) => {
    const [hasError, setHasError] = React.useState(false)
    const defaultFormat = React.useMemo(
      () => (supportWebp() ? 'webp' : undefined),
      [],
    );

    // src 为空或加载失败 → 暖橙占位 + 首字/餐具图标
    const placeholderText = fallbackText || alt || ''
    const firstChar = placeholderText.charAt(0) || ''

    if (!src || hasError) {
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          className={cn(
            'flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 text-orange-400 select-none',
            className,
          )}
          style={typeof width === 'number' ? { width } : undefined}
        >
          {firstChar ? (
            <span className="text-lg font-semibold leading-none">{firstChar}</span>
          ) : (
            <Utensils className="size-6 opacity-60" />
          )}
        </div>
      )
    }

    const handleError = () => setHasError(true)

    // 当 src 不在白名单时，直接渲染原生 img，保留所有原生属性
    if (typeof src !== 'string' || !isTargetSrc(src)) {
      return (
        <img
          {...rest}
          ref={ref}
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          srcSet={userSrcSet}
          className={cn(
            'bg-linear-to-b from-gray-50/20 to-gray-200/20',
            className,
          )}
          loading={loading}
          decoding={decoding}
          onError={handleError}
        />
      );
    }

    // 只有当 width 是数字类型时才进行 srcSet 优化
    const numericWidth = typeof width === 'number' ? width : undefined;

    // 用户传入的 srcSet 优先，否则生成优化的 srcSet
    const srcSet =
      userSrcSet ??
      buildSrcSet(
        src,
        breakpoints,
        format ?? (defaultFormat as ImageFormat),
        quality,
        numericWidth,
        sizes,
      );

    const baseSrc = applyParamsToUrl(src, {
      resize: numericWidth ? `w_${numericWidth}` : undefined,
      quality: `Q_${quality}`,
      format: format ?? defaultFormat,
    });

    return (
      <img
        {...rest}
        ref={ref}
        src={baseSrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        srcSet={srcSet}
        className={cn(
          'bg-linear-to-b from-gray-50/20 to-gray-200/20',
          className,
        )}
        loading={loading}
        decoding={decoding}
        onError={handleError}
      />
    );
  },
);

Image.displayName = 'Image';

export default Image;
