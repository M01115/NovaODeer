import SwiftUI

/// Vertical distance between nodes.
private let nodeSpacing: CGFloat = 116
/// Space above the first node.
private let topSpace: CGFloat = 72
/// Space below the last node.
private let bottomSpace: CGFloat = 200
/// Side-to-side wiggle, as a fraction of the amplitude. Repeats every 8 nodes.
private let wiggle: [CGFloat] = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6]
/// Height of the 3D "lip" under each node.
private let depth: CGFloat = 5
/// Extra room above and below today's node for its bigger size and the TODAY bubble.
private let todayGap: CGFloat = 46

private let ice = Color(hex: 0xEAF4FA)
private let iceDark = Color(hex: 0xC6DAE6)

private func nodeSize(_ status: DayStatus) -> CGFloat {
    switch status {
    case .done: 72
    case .frozen: 64
    case .missed: 56
    case .today: 92
    case .locked: 60
    }
}

private func nodeY(_ index: Int, todayIndex: Int?) -> CGFloat {
    var y = topSpace + CGFloat(index) * nodeSpacing
    if let todayIndex, index >= todayIndex { y += todayGap }
    if let todayIndex, index > todayIndex { y += todayGap }
    return y
}

/// Past sketches as a Duolingo-style winding path, opened from the top bar on Home.
/// Opens scrolled to today's node. Ported from mobile/src/app/journey.tsx.
struct JourneyView: View {
    @Environment(\.dismiss) private var dismiss
    private let days = History.get()
    @State private var openSketch: Day?

    var body: some View {
        let sketchCount = days.filter { $0.status == .done }.count

        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading) {
                    Text("Your sketch path").font(.system(size: 18, weight: .bold)).foregroundStyle(Palette.text)
                    Text("\(sketchCount) sketches so far").textStyle(.small, color: Palette.textSecondary)
                }
                Spacer()
                CloseButton()
            }
            .padding(.horizontal, Spacing.four)
            .padding(.vertical, Spacing.two)

            GeometryReader { geo in
                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        SketchPath(
                            days: days,
                            width: geo.size.width,
                            // Today's prompt lives on Home, so today's node takes you back there.
                            onPressToday: { dismiss() },
                            onOpenSketch: { openSketch = $0 }
                        )
                    }
                    .onAppear {
                        // Land on today's node, centered.
                        proxy.scrollTo("today", anchor: .center)
                    }
                }
            }
        }
        .background(Palette.background)
        .sheet(item: $openSketch) { SketchDetailView(day: $0) }
    }
}

/// Duolingo-style winding path: past sketches, today's node, then locked days,
/// joined by a curved line. Ported from mobile/src/components/sketch-path.tsx.
struct SketchPath: View {
    let days: [Day]
    let width: CGFloat
    /// Today's node was tapped.
    let onPressToday: () -> Void
    /// "See my sketch" was tapped in a past day's popover.
    let onOpenSketch: (Day) -> Void

    /// Past day whose popover is open (card under the node).
    @State private var selected: String?

    private var todayIndex: Int? { days.firstIndex { $0.status == .today } }

    private var points: [CGPoint] {
        let amplitude = min(width * 0.26, 100)
        return days.indices.map { i in
            CGPoint(x: width / 2 + wiggle[i % wiggle.count] * amplitude, y: nodeY(i, todayIndex: todayIndex))
        }
    }

    var body: some View {
        let points = points
        let height = nodeY(days.count - 1, todayIndex: todayIndex) + bottomSpace
        let selectedIndex = selected.flatMap { key in days.firstIndex { $0.id == key } }

        ZStack(alignment: .topLeading) {
            // The curved line, drawn one segment at a time so the future part can be dashed.
            ForEach(0..<max(0, points.count - 1), id: \.self) { i in
                let a = points[i], b = points[i + 1]
                let reached = i + 1 <= (todayIndex ?? -1)
                Path { p in
                    let midY = (a.y + b.y) / 2
                    p.move(to: a)
                    p.addCurve(to: b, control1: CGPoint(x: a.x, y: midY), control2: CGPoint(x: b.x, y: midY))
                }
                .stroke(
                    reached ? Ink.ink : Ink.pencil,
                    style: StrokeStyle(lineWidth: reached ? 5 : 4, lineCap: .round, dash: reached ? [] : [2, 12])
                )
            }

            ForEach(Array(days.enumerated()), id: \.element.id) { i, day in
                let size = nodeSize(day.status)
                VStack(spacing: 4) {
                    PathNode(day: day, size: size) {
                        if day.status == .today {
                            onPressToday()
                        } else {
                            withAnimation(.easeOut(duration: 0.15)) {
                                selected = selected == day.id ? nil : day.id
                            }
                        }
                    }
                    .overlay(alignment: .top) {
                        if day.status == .today { TodayBubble().offset(y: -44) }
                    }
                    NodeLabel(day: day)
                }
                .frame(width: 120)
                .offset(x: points[i].x - 60, y: points[i].y - size / 2)
                .id(day.status == .today ? "today" : day.id)
            }

            // Smudge cheers you on beside today's node, on the roomier side.
            if let todayIndex {
                let p = points[todayIndex]
                let half = nodeSize(.today) / 2
                Smudge(size: 84)
                    .offset(x: p.x >= width / 2 ? p.x - half - 104 : p.x + half + 16, y: p.y - 50)
                    .allowsHitTesting(false)
            }

            if let selectedIndex {
                // Tap anywhere else on the path to close the popover.
                Color.black.opacity(0.001)
                    .frame(width: width, height: height)
                    .onTapGesture { withAnimation(.easeOut(duration: 0.12)) { selected = nil } }

                let day = days[selectedIndex]
                DayPopover(
                    day: day,
                    width: width,
                    nodeX: points[selectedIndex].x,
                    onOpen: {
                        selected = nil
                        onOpenSketch(day)
                    }
                )
                .offset(y: points[selectedIndex].y + nodeSize(day.status) / 2 + depth + 28)
                .transition(.opacity)
            }
        }
        .frame(width: width, height: height, alignment: .topLeading)
    }
}

/// A circle with a darker lip underneath, so it looks pressable (and sinks when pressed).
private struct RaisedStyle: ButtonStyle {
    let size: CGFloat
    let top: Color
    let bottom: Color

    func makeBody(configuration: Configuration) -> some View {
        ZStack(alignment: .top) {
            Circle().fill(bottom).frame(width: size, height: size).offset(y: depth)
            Circle().fill(top).frame(width: size, height: size)
                .overlay { configuration.label }
                .offset(y: configuration.isPressed ? depth : 0)
        }
        .frame(width: size, height: size + depth, alignment: .top)
    }
}

private struct PathNode: View {
    let day: Day
    let size: CGFloat
    let onPress: () -> Void

    var body: some View {
        switch day.status {
        case .done:
            Button(action: onPress) {
                SketchThumb(size: size - 10, imageURL: day.imageURL, emoji: day.prompt.emoji)
            }
            .buttonStyle(RaisedStyle(size: size, top: Ink.ink, bottom: Ink.pencil))
        case .today:
            Button(action: onPress) {
                Text("✏️").font(.system(size: size * 0.42))
            }
            .buttonStyle(RaisedStyle(size: size, top: Ink.ink, bottom: Ink.inkLip))
            .padding(6)
            .overlay(Circle().stroke(Ink.pencil, lineWidth: 3))
            .padding(-9)
        case .frozen:
            Button(action: onPress) {
                Text("❄️").font(.system(size: size * 0.42))
            }
            .buttonStyle(RaisedStyle(size: size, top: ice, bottom: iceDark))
        case .missed:
            Button(action: onPress) {
                Text("z z")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Palette.textSecondary)
                    .frame(width: size, height: size)
                    .background(Palette.background, in: Circle())
                    .overlay(Circle().strokeBorder(Palette.backgroundSelected, style: StrokeStyle(lineWidth: 3, dash: [6, 4])))
            }
            .buttonStyle(.plain)
        case .locked:
            Button {} label: {
                Text("🔒").font(.system(size: size * 0.34)).opacity(0.6)
            }
            .buttonStyle(RaisedStyle(size: size, top: Palette.backgroundElement, bottom: Palette.backgroundSelected))
            .disabled(true)
        }
    }
}

private struct TodayBubble: View {
    var body: some View {
        VStack(spacing: -7) {
            Text("TODAY")
                .font(.system(size: 13, weight: .heavy))
                .tracking(1)
                .foregroundStyle(Ink.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.ink, lineWidth: 2))
                .zIndex(1)
            // Tail: a rotated square showing only its bottom-right edges.
            Rectangle()
                .fill(.white)
                .frame(width: 12, height: 12)
                .overlay(alignment: .bottomTrailing) {
                    ZStack(alignment: .bottomTrailing) {
                        Rectangle().fill(Ink.ink).frame(width: 12, height: 2)
                        Rectangle().fill(Ink.ink).frame(width: 2, height: 12)
                    }
                }
                .rotationEffect(.degrees(45))
                .zIndex(2)
        }
        .allowsHitTesting(false)
    }
}

private struct NodeLabel: View {
    let day: Day

    var body: some View {
        let text: String? = switch day.status {
        case .done: History.shortDate(day.date)
        case .frozen: "Freeze used"
        case .missed: "Rest day"
        case .today: "Tap to start"
        case .locked: nil
        }
        if let text {
            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(day.status == .today ? Palette.text : Palette.textSecondary)
                .padding(.horizontal, 6)
                // Paper behind the text so the path line passes under the label.
                .background(Palette.background, in: RoundedRectangle(cornerRadius: 6))
        }
    }
}

/// Card under a past node: the drawing, and an arrow button to see it full size.
private struct DayPopover: View {
    let day: Day
    let width: CGFloat
    let nodeX: CGFloat
    let onOpen: () -> Void

    private let margin: CGFloat = 16

    var body: some View {
        let tailLeft = min(max(nodeX - margin - 10, 20), width - margin * 2 - 40)

        var title = day.prompt.text
        var message: String?
        if day.status == .frozen {
            title = "Streak freeze ❄️"
            message = "You missed this one, but a freeze kept your streak alive."
        }
        if day.status == .missed {
            title = "Rest day"
            message = "Everyone needs a break. Smudge napped too."
        }

        return VStack(spacing: 14) {
            HStack(spacing: 14) {
                if day.status == .done {
                    SketchThumb(size: 72, imageURL: day.imageURL, emoji: day.prompt.emoji, shape: .card)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(History.shortDate(day.date)).textStyle(.small, color: Palette.textSecondary)
                    Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(Palette.text)
                    if let message {
                        Text(message).textStyle(.small, color: Palette.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if day.status == .done {
                Button(action: onOpen) {
                    Text("SEE MY SKETCH  →")
                        .font(.system(size: 15, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(.white)
                        .padding(.vertical, 12)
                }
                .buttonStyle(LipButtonStyle())
            }
        }
        .padding(16)
        .background(Ink.paper, in: RoundedRectangle(cornerRadius: 20))
        .background(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 3)
                .fill(Ink.paper)
                .frame(width: 20, height: 20)
                .rotationEffect(.degrees(45))
                .offset(x: tailLeft, y: -8)
        }
        .compositingGroup()
        .shadow(color: .black.opacity(0.12), radius: 12, y: 8)
        .frame(width: width - margin * 2)
        .offset(x: margin)
    }
}

/// A past day's sketch and Smudge's feedback, opened from its node on the path.
/// Ported from mobile/src/app/sketch/[date].tsx.
struct SketchDetailView: View {
    let day: Day

    var body: some View {
        Screen {
            HStack { Spacer(); CloseButton() }

            if day.status != .done {
                EmptyState(emoji: "🔍", title: "No sketch here", message: "This day doesn’t have a sketch.")
            } else {
                VStack(alignment: .leading, spacing: Spacing.one) {
                    Text(History.shortDate(day.date)).textStyle(.small, color: Palette.textSecondary)
                    Text(day.prompt.text).textStyle(.subtitle)
                }

                SketchThumb(size: 300, imageURL: day.imageURL, emoji: day.prompt.emoji, shape: .card)
                    .frame(maxWidth: .infinity)

                if let feedback = day.feedback {
                    HStack(spacing: Spacing.three) {
                        Smudge(size: 64)
                        Text(feedback)
                            .textStyle(.small)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Spacing.three)
                            .background(Palette.backgroundElement, in: RoundedRectangle(cornerRadius: Spacing.four))
                    }
                }
            }
        }
    }
}

#Preview {
    JourneyView()
}
