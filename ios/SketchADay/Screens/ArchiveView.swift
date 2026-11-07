import SwiftUI

private let bg = Color(hex: 0xF2F1EE)
private let ink = Color(hex: 0x161616)
private let muted = Color(hex: 0x8A877F)
/// Label dots, from the team's "color archive" palette.
private let dots: [Color] = [0x462E24, 0xA4BCD4, 0x490B0C, 0xE2C98A, 0x1D120E].map { Color(hex: $0) }

/// Points of drag per card when scrubbing through the stack.
private let dragPerCard: CGFloat = 90

/// Piecewise-linear interpolation, like Reanimated's `interpolate`.
private func interpolate(_ x: Double, _ input: [Double], _ output: [Double], clamp: Bool) -> Double {
    if x <= input.first! {
        if clamp { return output.first! }
        let slope = (output[1] - output[0]) / (input[1] - input[0])
        return output[0] + (x - input[0]) * slope
    }
    if x >= input.last! {
        if clamp { return output.last! }
        let n = input.count
        let slope = (output[n - 1] - output[n - 2]) / (input[n - 1] - input[n - 2])
        return output[n - 1] + (x - input[n - 1]) * slope
    }
    for i in 0..<(input.count - 1) where x <= input[i + 1] {
        let t = (x - input[i]) / (input[i + 1] - input[i])
        return output[i] + t * (output[i + 1] - output[i])
    }
    return output.last!
}

/// The sketch archive: past sketches as a diagonal stack of cards. The middle card is
/// fully exposed (like a hover); drag to move through the stack, tap a card to bring it
/// to the middle, tap the middle one to pop it up.
/// Ported from mobile/src/app/archive.tsx.
struct ArchiveView: View {
    @Environment(\.dismiss) private var dismiss
    private let sketches = History.get().filter { $0.status == .done }

    /// Which card is in the middle, as a float so the stack can move between cards.
    @State private var focus: Double = 0
    @State private var dragStart: Double?
    @State private var zoomed: Day?
    @State private var appeared = false

    private var last: Double { Double(sketches.count - 1) }
    private var focusIndex: Int { Int(focus.rounded()) }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Sketched anywhere.").foregroundStyle(ink)
                Text("Kept in one place.").foregroundStyle(muted)
                Text("\(focusIndex + 1) / \(sketches.count) · drag to flip through")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.3)
                    .foregroundStyle(muted)
                    .padding(.top, 10)
            }
            .font(.system(size: 24, weight: .bold))
            .tracking(-0.5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.top, 28)

            GeometryReader { geo in
                ZStack(alignment: .topLeading) {
                    // Newer cards (in front) are drawn on top.
                    ForEach(Array(sketches.enumerated()), id: \.element.id) { i, day in
                        card(day: day, index: i, stage: geo.size)
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                .contentShape(Rectangle())
                .gesture(scrub)
            }

            Button { dismiss() } label: {
                VStack(spacing: 0) {
                    Text("︿").font(.system(size: 18, weight: .bold)).foregroundStyle(ink)
                    Text("Back to today").font(.system(size: 13, weight: .semibold)).foregroundStyle(muted)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 16)
                // Sits above any cards that cascade down this far.
                .background(bg, in: RoundedRectangle(cornerRadius: 16))
            }
            .buttonStyle(PressedOpacity())
            .padding(.bottom, 12)
            .accessibilityLabel("Back to today")
        }
        .background(bg)
        // Archive drops in from above (it lives "above" Home).
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : -48)
        .overlay {
            if let zoomed {
                ZoomedSketch(day: zoomed) {
                    withAnimation(.easeOut(duration: 0.15)) { self.zoomed = nil }
                }
                .transition(.opacity)
            }
        }
        .onAppear {
            focus = last
            withAnimation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.32)) { appeared = true }
        }
    }

    // MARK: Cards

    private func card(day: Day, index: Int, stage: CGSize) -> some View {
        let cardW = min(stage.width * 0.6, 240)
        let imageSize = cardW - 16
        let cardH = imageSize + 16 + 40

        // Middle card's top-left corner.
        let baseX = (stage.width - cardW) / 2 + 12
        let baseY = (stage.height - cardH) / 2 - 10

        // Behind (older): step up and to the right. In front (newer): jump well clear to the
        // bottom left so the middle card stays fully visible, then step on from there.
        let stepX = min(30, stage.width * 0.075)
        let stepY: CGFloat = 34
        let clearX = cardW * 0.66
        let clearY = cardH * 1.05

        let d = Double(index) - focus
        let opacity = interpolate(d, [-7, -5.5, 3, 4.5], [0, 1, 1, 0], clamp: true)
        let tx = interpolate(d, [-8, 0, 1, 6], [8 * stepX, 0, -clearX, -clearX - 5 * stepX], clamp: false)
        let ty = interpolate(d, [-8, 0, 1, 6], [-8 * stepY, 0, clearY, clearY + 5 * stepY], clamp: false)
        // The middle card is a touch bigger: the "hovered" one.
        let scale = interpolate(d, [-8, -1, 0, 1], [0.82, 0.94, 1, 0.94], clamp: true)
        let isFocused = index == focusIndex

        return Button {
            if isFocused {
                withAnimation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.24)) { zoomed = day }
            } else {
                withAnimation(.spring(duration: 0.4, bounce: 0)) { focus = Double(index) }
            }
        } label: {
            VStack(spacing: 0) {
                SketchThumb(size: imageSize, imageURL: day.imageURL, emoji: day.prompt.emoji, shape: .card)
                HStack(spacing: 6) {
                    Text(day.prompt.text.uppercased())
                        .font(.system(size: 10.5, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(ink)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(History.shortDate(day.date))
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(muted)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(dots[index % dots.count])
                        .frame(width: 8, height: 8)
                }
                .frame(height: 40)
                .padding(.horizontal, 4)
            }
            .padding(8)
            .frame(width: cardW, height: cardH)
            .background(.white, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.10), radius: 10, y: 6)
        }
        .buttonStyle(.plain)
        .scaleEffect(scale)
        .offset(x: baseX + tx, y: baseY + ty)
        .opacity(opacity)
        .allowsHitTesting(opacity > 0.05)
        .accessibilityLabel("\(day.prompt.text), \(History.shortDate(day.date))\(isFocused ? ", open" : "")")
    }

    // MARK: Drag to scrub

    private var scrub: some Gesture {
        DragGesture(minimumDistance: 10)
            .onChanged { value in
                if dragStart == nil { dragStart = focus }
                // Pull down = older cards come forward from the top right.
                let raw = dragStart! - value.translation.height / dragPerCard
                // Rubber-band past either end of the stack.
                let over = raw < 0 ? raw : (raw > last ? raw - last : 0)
                focus = raw - over + over * 0.35
            }
            .onEnded { value in
                dragStart = nil
                let flick = -(value.predictedEndTranslation.height - value.translation.height) / dragPerCard
                let target = min(last, max(0, (focus + flick * 0.6).rounded()))
                withAnimation(.spring(duration: 0.4, bounce: 0.2)) { focus = target }
            }
    }
}

/// The middle card, popped up and enlarged, with Smudge's note and friends' reactions.
private struct ZoomedSketch: View {
    let day: Day
    let onClose: () -> Void

    // Placeholder counts until reactions come from the backend.
    private let counts = [12, 7, 5, 3, 2, 1]

    var body: some View {
        ZStack {
            ink.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)
                .accessibilityLabel("Close")

            VStack(spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading) {
                        Text(History.shortDate(day.date))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(muted)
                        Text(day.prompt.text)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(ink)
                    }
                    Spacer()
                    Button(action: onClose) {
                        Text("✕").font(.system(size: 16, weight: .bold)).foregroundStyle(ink).padding(4)
                    }
                    .buttonStyle(PressedOpacity())
                    .accessibilityLabel("Close")
                }

                SketchThumb(size: 300, imageURL: day.imageURL, emoji: day.prompt.emoji, shape: .card)

                if let feedback = day.feedback {
                    HStack(spacing: 10) {
                        Smudge(size: 44)
                        Text(feedback)
                            .font(.system(size: 13))
                            .foregroundStyle(ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                HStack {
                    ForEach(Array(Reactions.all.enumerated()), id: \.offset) { i, r in
                        VStack(spacing: 2) {
                            Text(r).font(.system(size: 20))
                            Text("\(counts[i])")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(muted)
                        }
                        if i < Reactions.all.count - 1 { Spacer() }
                    }
                }
            }
            .padding(18)
            .frame(width: 340)
            .background(.white, in: RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.25), radius: 25, y: 20)
            .transition(.scale(scale: 0.9).combined(with: .opacity))
        }
    }
}

#Preview {
    ArchiveView()
}
