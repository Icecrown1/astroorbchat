import AppKit
import Foundation

let mobile = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let app = mobile.appendingPathComponent("ios/App/App")
let assets = app.appendingPathComponent("Assets.xcassets")
let brand = mobile.deletingLastPathComponent().appendingPathComponent("client/public/brand/icon-512.png")

guard let source = NSImage(contentsOf: brand) else {
    fatalError("AstroOrbi brand icon could not be loaded")
}

func writeBrandImage(at path: String, markSize: CGFloat, transparent: Bool) throws {
    let size = 1024
    let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { bounds in
        if !transparent {
            NSColor(srgbRed: 11 / 255, green: 13 / 255, blue: 20 / 255, alpha: 1).setFill()
            bounds.fill()
        }
        let origin = (CGFloat(size) - markSize) / 2
        source.draw(in: NSRect(x: origin, y: origin, width: markSize, height: markSize))
        return true
    }

    var rect = NSRect(x: 0, y: 0, width: size, height: size)
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        fatalError("AstroOrbi brand image could not be rendered")
    }
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: transparent ? 4 : 3, hasAlpha: transparent, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current?.cgContext.draw(cgImage, in: rect)
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("AstroOrbi brand image could not be encoded")
    }
    try png.write(to: assets.appendingPathComponent(path))
}

try writeBrandImage(at: "AppIcon.appiconset/AppIcon-512@2x.png", markSize: 1024, transparent: false)
let splash = "Splash.imageset"
try writeBrandImage(at: "\(splash)/astroorbi-splash.png", markSize: 400, transparent: true)
try """
{
  "images": [{ "filename": "astroorbi-splash.png", "idiom": "universal" }],
  "info": { "author": "xcode", "version": 1 }
}
""".write(to: assets.appendingPathComponent("\(splash)/Contents.json"), atomically: true, encoding: .utf8)

let launch = app.appendingPathComponent("Base.lproj/LaunchScreen.storyboard")
let storyboard = try String(contentsOf: launch, encoding: .utf8)
try storyboard
    .replacingOccurrences(of: "contentMode=\"scaleAspectFill\"", with: "contentMode=\"scaleAspectFit\"")
    .replacingOccurrences(
        of: "<color key=\"backgroundColor\" systemColor=\"systemBackgroundColor\"/>",
        with: "<color key=\"backgroundColor\" red=\"0.090196\" green=\"0.078431\" blue=\"0.145098\" alpha=\"1\" colorSpace=\"custom\" customColorSpace=\"sRGB\"/>"
    )
    .replacingOccurrences(of: "width=\"1366\" height=\"1366\"", with: "width=\"1024\" height=\"1024\"")
    .write(to: launch, atomically: true, encoding: .utf8)
