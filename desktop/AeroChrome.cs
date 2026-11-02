using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace TRIScore.Desktop;

// The web document stays untouched. Only this native caption and the real MenuStrip
// are painted here. Native thick-frame/system-menu styles retain desktop behavior.
internal class AeroWindow : Form
{
    private const int WM_NCCALCSIZE = 0x83, WM_NCHITTEST = 0x84, WM_NCLBUTTONDOWN = 0xA1,
        WM_NCLBUTTONUP = 0xA2, WM_NCLBUTTONDBLCLK = 0xA3, WM_NCRBUTTONUP = 0xA5,
        WM_NCMOUSEMOVE = 0xA0, WM_NCMOUSELEAVE = 0x2A2, WM_MOUSEMOVE = 0x200,
        WM_LBUTTONUP = 0x202, WM_DWMCOMPOSITIONCHANGED = 0x31E, WM_SYSCOMMAND = 0x112;
    private const int HTCLIENT = 1, HTCAPTION = 2, HTSYSMENU = 3, HTMINBUTTON = 8,
        HTMAXBUTTON = 9, HTCLOSE = 20, HTTRANSPARENT = -1;
    private const int SC_MINIMIZE = 0xF020, SC_MAXIMIZE = 0xF030, SC_CLOSE = 0xF060,
        SC_RESTORE = 0xF120, SC_KEYMENU = 0xF100;
    private readonly ChromeHost chromeHost;
    private readonly CaptionSurface caption;
    private readonly CaptionButton minimize, maximize, close;
    private MenuStrip? aeroMenu;
    private Color chromeBackground = Color.FromArgb(14, 22, 33), chromeAccent = Color.FromArgb(104, 190, 230),
        chromeText = Color.FromArgb(231, 241, 248);
    private bool chromeDark = true, active = true, arranging, applyingDwm;
    private int hoverHit, pressedHit;
    private string backdrop = "solid-fallback";
    private bool dwmBorder;

    internal int ChromeCaptionHeight => Scale(34);
    internal int ChromeHeight => ChromeCaptionHeight + (aeroMenu == null ? 0 : Scale(26));
    internal bool ChromeIsHighContrast => SystemInformation.HighContrast;
    private int Scale(int value) => Math.Max(1, (int)Math.Round(value * DeviceDpi / 96d));
    private AeroPalette Palette => new(chromeBackground, chromeAccent, chromeText, chromeDark, ChromeIsHighContrast, active);

    internal AeroWindow()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        FormBorderStyle = FormBorderStyle.Sizable;
        chromeHost = new ChromeHost(this) { TabStop = false };
        caption = new CaptionSurface(this) { TabStop = false };
        minimize = new CaptionButton(this, HTMINBUTTON, "Minimize");
        maximize = new CaptionButton(this, HTMAXBUTTON, "Maximize");
        close = new CaptionButton(this, HTCLOSE, "Close");
        caption.Controls.AddRange([minimize, maximize, close]);
        chromeHost.Controls.Add(caption);
        Controls.Add(chromeHost);
        ArrangeChrome();
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.Style = (cp.Style & ~0x00C00000) | 0x00040000 | 0x00080000 | 0x00020000 | 0x00010000;
            return cp; // no standard caption paint; keep resize, system menu, min/max.
        }
    }

    internal void ApplyAeroTheme(Color background, Color accent, Color text, bool dark)
    {
        if (chromeBackground == background && chromeAccent == accent && chromeText == text && chromeDark == dark) return;
        chromeBackground = Color.FromArgb(background.R, background.G, background.B);
        chromeAccent = Color.FromArgb(accent.R, accent.G, accent.B);
        chromeText = Color.FromArgb(text.R, text.G, text.B);
        chromeDark = dark;
        RefreshChrome();
    }

    internal void StyleMenu(MenuStrip menu)
    {
        aeroMenu = menu;
        menu.Parent = chromeHost;
        menu.Dock = DockStyle.None;
        menu.AutoSize = false;
        menu.GripStyle = ToolStripGripStyle.Hidden;
        menu.Padding = new Padding(Scale(9), Scale(1), Scale(6), 0);
        menu.Renderer = new GlassMenuRenderer(this);
        menu.Font = new Font("Segoe UI", 9f, FontStyle.Regular, GraphicsUnit.Point);
        menu.ForeColor = Palette.Text;
        menu.BackColor = Palette.Base;
        ArrangeChrome();
        RefreshChrome();
    }

    private void ArrangeChrome()
    {
        if (arranging || chromeHost == null) return;
        arranging = true;
        try
        {
            int edge = WindowState == FormWindowState.Maximized ? 0 : Scale(6);
            var p = new Padding(edge, ChromeHeight, edge, edge);
            if (Padding != p) Padding = p;
            chromeHost.Bounds = new Rectangle(0, 0, ClientSize.Width, ChromeHeight);
            caption.Bounds = new Rectangle(0, 0, ClientSize.Width, ChromeCaptionHeight);
            foreach (var (button, hit) in new[] { (minimize, HTMINBUTTON), (maximize, HTMAXBUTTON), (close, HTCLOSE) })
                button.Bounds = GetChromeButtonBounds(hit);
            maximize.AccessibleName = WindowState == FormWindowState.Maximized ? "Restore" : "Maximize";
            if (aeroMenu != null) aeroMenu.Bounds = new Rectangle(edge, ChromeCaptionHeight, Math.Max(0, ClientSize.Width - edge * 2), Scale(26));
            chromeHost.BringToFront();
        }
        finally { arranging = false; }
    }

    internal Rectangle GetChromeButtonBounds(string name) => GetChromeButtonBounds(name switch
    {
        "minimize" => HTMINBUTTON, "maximize" or "restore" => HTMAXBUTTON, "close" => HTCLOSE, _ => 0
    });
    private Rectangle GetChromeButtonBounds(int hit)
    {
        int width = Scale(46), index = hit == HTCLOSE ? 0 : hit == HTMAXBUTTON ? 1 : hit == HTMINBUTTON ? 2 : -1;
        return index < 0 ? Rectangle.Empty : new Rectangle(ClientSize.Width - Scale(7) - width * (index + 1), Scale(1), width, ChromeCaptionHeight - Scale(3));
    }
    private Rectangle IconBounds => new(Scale(11), Scale(7), Scale(20), Scale(20));

    // Client coordinates, including negative values: useful for isolated host tests.
    internal int HitTestChrome(Point point)
    {
        int x = point.X, y = point.Y, width = ClientSize.Width, height = ClientSize.Height;
        if (WindowState != FormWindowState.Maximized)
        {
            int edge = Scale(6);
            bool left = x < edge, right = x >= width - edge, top = y < edge, bottom = y >= height - edge;
            if (top && left) return 13;
            if (top && right) return 14;
            if (bottom && left) return 16;
            if (bottom && right) return 17;
            if (left) return 10;
            if (right) return 11;
            if (top) return 12;
            if (bottom) return 15;
        }
        foreach (int hit in new[] { HTCLOSE, HTMAXBUTTON, HTMINBUTTON })
            if (GetChromeButtonBounds(hit).Contains(point)) return hit;
        if (IconBounds.Contains(point)) return HTSYSMENU;
        return y >= 0 && y < ChromeCaptionHeight ? HTCAPTION : HTCLIENT;
    }

    internal object InspectChrome() => new
    {
        dark = chromeDark, background = ColorTranslator.ToHtml(chromeBackground),
        accent = ColorTranslator.ToHtml(chromeAccent), text = ColorTranslator.ToHtml(chromeText),
        captionHeight = ChromeCaptionHeight, chromeHeight = ChromeHeight, highContrast = ChromeIsHighContrast,
        captionButtons = new { minimize = GetChromeButtonBounds(HTMINBUTTON), maximize = GetChromeButtonBounds(HTMAXBUTTON), close = GetChromeButtonBounds(HTCLOSE) },
        backdrop, dwmBorder, nativeResize = true, nativeSystemMenu = true,
        menuNative = aeroMenu != null, menuBelowCaption = aeroMenu?.Top == ChromeCaptionHeight
    };

    protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); ArrangeChrome(); ApplyDwm(); }
    protected override void OnLayout(LayoutEventArgs e) { base.OnLayout(e); ArrangeChrome(); }
    protected override void OnResize(EventArgs e) { base.OnResize(e); ArrangeChrome(); caption?.Invalidate(true); }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        base.OnPaintBackground(e);
        if (WindowState == FormWindowState.Maximized) return;
        int edge = Scale(6);
        using var brush = new SolidBrush(Blend(Palette.Base, Palette.Border, .18));
        e.Graphics.FillRectangle(brush, 0, 0, edge, ClientSize.Height);
        e.Graphics.FillRectangle(brush, ClientSize.Width - edge, 0, edge, ClientSize.Height);
        e.Graphics.FillRectangle(brush, 0, ClientSize.Height - edge, ClientSize.Width, edge);
    }
    protected override void OnDpiChanged(DpiChangedEventArgs e) { base.OnDpiChanged(e); ArrangeChrome(); ApplyDwm(); }
    protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); caption?.Invalidate(); }
    protected override void OnActivated(EventArgs e) { base.OnActivated(e); active = true; RefreshChrome(); }
    protected override void OnDeactivate(EventArgs e) { base.OnDeactivate(e); active = false; hoverHit = pressedHit = 0; RefreshChrome(); }
    protected override void OnSystemColorsChanged(EventArgs e) { base.OnSystemColorsChanged(e); RefreshChrome(); }
    protected override void OnMouseCaptureChanged(EventArgs e)
    {
        base.OnMouseCaptureChanged(e);
        if (!Capture && pressedHit != 0) { pressedHit = 0; caption.Invalidate(true); }
    }
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == (Keys.Alt | Keys.Space)) { ShowSystemMenu(PointToScreen(new Point(Scale(12), ChromeCaptionHeight))); return true; }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    private void RefreshChrome()
    {
        if (caption == null) return;
        Invalidate();
        chromeHost.Invalidate();
        caption.Invalidate(true);
        if (aeroMenu != null) { aeroMenu.ForeColor = Palette.Text; aeroMenu.BackColor = Palette.Base; aeroMenu.Invalidate(true); }
        ApplyDwm();
    }
    private void ApplyDwm()
    {
        if (!IsHandleCreated || applyingDwm) return;
        applyingDwm = true;
        try
        {
            var p = Palette;
            int dark = chromeDark && !ChromeIsHighContrast ? 1 : 0, corners = 2;
            SetDwm(20, dark);
            SetDwm(33, corners);
            dwmBorder = SetDwm(34, ColorRef(p.Border));
            SetDwm(35, ColorRef(p.Base)); SetDwm(36, ColorRef(p.Text));
            int material = ChromeIsHighContrast ? 1 : 2;
            backdrop = OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22621) && SetDwm(38, material) && !ChromeIsHighContrast ? "system-mainwindow" : "solid-fallback";
            var margin = new Margins { Left = 1, Right = 1, Top = ChromeIsHighContrast ? 0 : ChromeHeight, Bottom = 1 };
            DwmExtendFrameIntoClientArea(Handle, ref margin);
        }
        catch (DllNotFoundException) { backdrop = "solid-fallback"; }
        catch (EntryPointNotFoundException) { backdrop = "solid-fallback"; }
        finally { applyingDwm = false; }
    }
    private bool SetDwm(int attribute, int value) => DwmSetWindowAttribute(Handle, attribute, ref value, sizeof(int)) >= 0;
    private static int ColorRef(Color color) => color.R | color.G << 8 | color.B << 16;
    private static Point SignedPoint(IntPtr value) => new(unchecked((short)(value.ToInt64() & 0xFFFF)), unchecked((short)((value.ToInt64() >> 16) & 0xFFFF)));
    private static bool IsButton(int hit) => hit is HTMINBUTTON or HTMAXBUTTON or HTCLOSE;
    private void SetHover(int hit)
    {
        hit = IsButton(hit) ? hit : 0;
        if (hoverHit == hit) return;
        hoverHit = hit; caption.Invalidate(true);
    }
    private void PerformButton(int hit)
    {
        int command = hit == HTCLOSE ? SC_CLOSE : hit == HTMINBUTTON ? SC_MINIMIZE :
            WindowState == FormWindowState.Maximized ? SC_RESTORE : SC_MAXIMIZE;
        SendMessage(Handle, WM_SYSCOMMAND, new IntPtr(command), IntPtr.Zero);
    }
    private void EndButton(Point clientPoint)
    {
        int pressed = pressedHit;
        pressedHit = 0;
        Capture = false;
        SetHover(HitTestChrome(clientPoint));
        caption.Invalidate(true);
        if (pressed != 0 && pressed == HitTestChrome(clientPoint)) PerformButton(pressed);
    }
    private void ShowSystemMenu(Point screenPoint)
    {
        var menu = GetSystemMenu(Handle, false);
        bool max = WindowState == FormWindowState.Maximized;
        EnableMenuItem(menu, SC_RESTORE, max ? 0u : 1u);
        EnableMenuItem(menu, SC_MAXIMIZE, max ? 1u : 0u);
        uint command = TrackPopupMenuEx(menu, 0x0102, screenPoint.X, screenPoint.Y, Handle, IntPtr.Zero);
        if (command != 0) SendMessage(Handle, WM_SYSCOMMAND, new IntPtr(command), IntPtr.Zero);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_NCCALCSIZE && m.WParam != IntPtr.Zero)
        {
            if (IsZoomed(Handle))
            {
                var monitor = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
                if (GetMonitorInfo(MonitorFromWindow(Handle, 2), ref monitor)) Marshal.StructureToPtr(monitor.Work, m.LParam, false);
            }
            m.Result = IntPtr.Zero; return;
        }
        if (m.Msg == WM_NCHITTEST)
        {
            // Always offer DWM first refusal; custom caption has no standard buttons.
            if (DwmDefWindowProc(Handle, m.Msg, m.WParam, m.LParam, out var result)) { m.Result = result; return; }
            m.Result = new IntPtr(HitTestChrome(PointToClient(SignedPoint(m.LParam)))); return;
        }
        if (m.Msg == WM_NCMOUSEMOVE)
        {
            SetHover(m.WParam.ToInt32());
            var track = new TrackMouse { Size = Marshal.SizeOf<TrackMouse>(), Flags = 0x12, Window = Handle };
            TrackMouseEvent(ref track);
        }
        else if (m.Msg == WM_NCMOUSELEAVE) { DwmDefWindowProc(Handle, m.Msg, m.WParam, m.LParam, out _); SetHover(0); }
        else if (m.Msg == WM_NCLBUTTONDOWN)
        {
            int hit = m.WParam.ToInt32();
            if (IsButton(hit)) { pressedHit = hit; SetHover(hit); Capture = true; caption.Invalidate(true); m.Result = IntPtr.Zero; return; }
            if (hit == HTSYSMENU) { ShowSystemMenu(PointToScreen(new Point(Scale(10), ChromeCaptionHeight))); m.Result = IntPtr.Zero; return; }
        }
        else if (m.Msg == WM_NCLBUTTONDBLCLK)
        {
            if (m.WParam.ToInt32() == HTCAPTION) { PerformButton(HTMAXBUTTON); m.Result = IntPtr.Zero; return; }
            if (m.WParam.ToInt32() == HTSYSMENU) { PerformButton(HTCLOSE); m.Result = IntPtr.Zero; return; }
        }
        else if (m.Msg == WM_NCRBUTTONUP && m.WParam.ToInt32() is HTCAPTION or HTSYSMENU)
        { ShowSystemMenu(SignedPoint(m.LParam)); m.Result = IntPtr.Zero; return; }
        else if (m.Msg == WM_MOUSEMOVE && pressedHit != 0) SetHover(HitTestChrome(SignedPoint(m.LParam)));
        else if (m.Msg == WM_LBUTTONUP && pressedHit != 0) { EndButton(SignedPoint(m.LParam)); m.Result = IntPtr.Zero; return; }
        else if (m.Msg == WM_NCLBUTTONUP && pressedHit != 0) { EndButton(PointToClient(SignedPoint(m.LParam))); m.Result = IntPtr.Zero; return; }
        else if (m.Msg == WM_SYSCOMMAND && (m.WParam.ToInt64() & 0xFFF0) == SC_KEYMENU && m.LParam.ToInt64() == 32)
        { ShowSystemMenu(PointToScreen(new Point(Scale(10), ChromeCaptionHeight))); m.Result = IntPtr.Zero; return; }
        base.WndProc(ref m);
        if (m.Msg == WM_DWMCOMPOSITIONCHANGED) ApplyDwm();
    }

    private sealed class ChromeHost(AeroWindow owner) : Panel
    {
        protected override void OnPaintBackground(PaintEventArgs e) => PaintGlass(e.Graphics, ClientRectangle, owner.Palette, false);
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST)
            {
                var point = owner.PointToClient(SignedPoint(m.LParam));
                if (point.Y < owner.ChromeCaptionHeight || owner.HitTestChrome(point) is >= 10 and <= 17)
                { m.Result = new IntPtr(HTTRANSPARENT); return; }
            }
            base.WndProc(ref m);
        }
    }
    private sealed class CaptionSurface : Control
    {
        private readonly AeroWindow owner;
        internal CaptionSurface(AeroWindow owner)
        {
            this.owner = owner;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            AccessibleName = "Window title bar"; AccessibleRole = AccessibleRole.TitleBar;
        }
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST) { m.Result = new IntPtr(HTTRANSPARENT); return; }
            base.WndProc(ref m);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            var p = owner.Palette;
            PaintGlass(e.Graphics, ClientRectangle, p, false);
            if (owner.Icon != null) e.Graphics.DrawIcon(owner.Icon, owner.IconBounds);
            var bounds = new Rectangle(owner.Scale(42), 0, Math.Max(0, owner.minimize.Left - owner.Scale(52)), Height);
            var flags = TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix;
            using var font = new Font("Segoe UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
            if (!p.HighContrast)
                TextRenderer.DrawText(e.Graphics, owner.Text, font, new Rectangle(bounds.X, bounds.Y + owner.Scale(1), bounds.Width, bounds.Height), p.Dark ? Color.FromArgb(17, 20, 28) : Color.White, flags);
            TextRenderer.DrawText(e.Graphics, owner.Text, font, bounds, p.Text, flags);
        }
    }
    private sealed class CaptionButton : Button
    {
        private readonly AeroWindow owner;
        private readonly int hit;
        internal CaptionButton(AeroWindow owner, int hit, string name)
        {
            this.owner = owner; this.hit = hit;
            Text = ""; AccessibleName = name; AccessibleRole = AccessibleRole.PushButton;
            AccessibleDescription = name == "Maximize" ? "Maximize or restore the window. Hover for Windows snap layouts." : name + " the window.";
            TabStop = true; FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Click += (_, _) => owner.PerformButton(hit);
        }
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST) { m.Result = new IntPtr(HTTRANSPARENT); return; }
            base.WndProc(ref m);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            var p = owner.Palette;
            PaintGlass(e.Graphics, ClientRectangle, p, false);
            bool hot = owner.hoverHit == hit || Focused, down = owner.pressedHit == hit;
            var r = new Rectangle(1, 1, Math.Max(1, Width - 3), Math.Max(1, Height - 3));
            if (hot)
            {
                Color glow = p.HighContrast ? SystemColors.Highlight : hit == HTCLOSE ? Color.FromArgb(220, 56, 59) : p.Accent;
                using Brush brush = p.HighContrast ? new SolidBrush(SystemColors.Highlight) :
                    new LinearGradientBrush(r, Blend(p.Base, glow, down ? .64 : .30), Blend(p.Base, glow, down ? .43 : .13), 90f);
                e.Graphics.FillRectangle(brush, r);
                using var outline = new Pen(p.HighContrast ? SystemColors.HighlightText : Blend(glow, Color.White, .28));
                e.Graphics.DrawRectangle(outline, r);
                using var shine = new Pen(Color.FromArgb(90, Color.White));
                if (!p.HighContrast) e.Graphics.DrawLine(shine, r.Left + 1, r.Top + 1, r.Right - 1, r.Top + 1);
            }
            Color ink = hot && p.HighContrast ? SystemColors.HighlightText : p.Text;
            using var pen = new Pen(ink, Math.Max(1f, owner.DeviceDpi / 96f));
            e.Graphics.SmoothingMode = SmoothingMode.None;
            int size = owner.Scale(9), x = (Width - size) / 2, y = (Height - size) / 2;
            if (hit == HTMINBUTTON) e.Graphics.DrawLine(pen, x, y + size - 1, x + size, y + size - 1);
            else if (hit == HTCLOSE) { e.Graphics.DrawLine(pen, x, y, x + size, y + size); e.Graphics.DrawLine(pen, x + size, y, x, y + size); }
            else if (owner.WindowState == FormWindowState.Maximized)
            {
                e.Graphics.DrawRectangle(pen, x + owner.Scale(2), y, size - owner.Scale(2), size - owner.Scale(2));
                using var fill = new SolidBrush(hot ? p.HighContrast ? SystemColors.Highlight : Blend(p.Base, p.Accent, .18) : p.Base);
                e.Graphics.FillRectangle(fill, x, y + owner.Scale(2), size - owner.Scale(2), size - owner.Scale(2));
                e.Graphics.DrawRectangle(pen, x, y + owner.Scale(2), size - owner.Scale(2), size - owner.Scale(2));
            }
            else e.Graphics.DrawRectangle(pen, x, y, size, size);
            if (Focused) ControlPaint.DrawFocusRectangle(e.Graphics, Rectangle.Inflate(ClientRectangle, -owner.Scale(5), -owner.Scale(5)), ink,
                hot && p.HighContrast ? SystemColors.Highlight : p.Base);
        }
    }

    private sealed class GlassMenuRenderer(AeroWindow owner) : ToolStripProfessionalRenderer
    {
        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e) =>
            PaintGlass(e.Graphics, e.AffectedBounds, owner.Palette, e.ToolStrip is ToolStripDropDown);
        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
            using var pen = new Pen(owner.Palette.Border);
            if (e.ToolStrip is ToolStripDropDown) e.Graphics.DrawRectangle(pen, 0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
            else e.Graphics.DrawLine(pen, 0, e.ToolStrip.Height - 1, e.ToolStrip.Width, e.ToolStrip.Height - 1);
        }
        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (!e.Item.Selected && !e.Item.Pressed) return;
            var p = owner.Palette;
            var r = new Rectangle(1, 1, Math.Max(1, e.Item.Width - 2), Math.Max(1, e.Item.Height - 2));
            using var brush = new LinearGradientBrush(r, p.HighContrast ? SystemColors.Highlight : Blend(p.Base, p.Accent, .40),
                p.HighContrast ? SystemColors.Highlight : Blend(p.Base, p.Accent, .17), 90f);
            e.Graphics.FillRectangle(brush, r);
            using var pen = new Pen(p.HighContrast ? SystemColors.HighlightText : Blend(p.Accent, p.Text, .18));
            e.Graphics.DrawRectangle(pen, r);
        }
        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextColor = !e.Item.Enabled ? SystemColors.GrayText : owner.Palette.HighContrast && e.Item.Selected ? SystemColors.HighlightText : owner.Palette.Text;
            base.OnRenderItemText(e);
        }
        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e) { e.ArrowColor = owner.Palette.Text; base.OnRenderArrow(e); }
        protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
        {
            using var b = new SolidBrush(Blend(owner.Palette.Base, owner.Palette.Accent, .06));
            e.Graphics.FillRectangle(b, e.AffectedBounds);
        }
        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            using var pen = new Pen(owner.Palette.Border);
            e.Graphics.DrawLine(pen, 8, e.Item.Height / 2, e.Item.Width - 8, e.Item.Height / 2);
        }
    }

    private readonly struct AeroPalette
    {
        internal readonly Color Base, Accent, Text, Border;
        internal readonly bool HighContrast, Dark, Active;
        internal AeroPalette(Color background, Color accent, Color text, bool dark, bool highContrast, bool active)
        {
            HighContrast = highContrast; Dark = dark; Active = active;
            Accent = highContrast ? SystemColors.Highlight : accent;
            Base = highContrast ? SystemColors.Control : Blend(background, accent, active ? dark ? .15 : .10 : .055);
            Text = highContrast ? SystemColors.ControlText : text;
            Border = highContrast ? SystemColors.WindowText : Blend(Base, accent, active ? .62 : .28);
        }
    }
    private static Color Blend(Color a, Color b, double amount) => Color.FromArgb(
        (int)Math.Round(a.R * (1 - amount) + b.R * amount), (int)Math.Round(a.G * (1 - amount) + b.G * amount), (int)Math.Round(a.B * (1 - amount) + b.B * amount));
    private static void PaintGlass(Graphics graphics, Rectangle bounds, AeroPalette p, bool dropdown)
    {
        if (bounds.Width < 1 || bounds.Height < 1) return;
        if (p.HighContrast) { using var solid = new SolidBrush(p.Base); graphics.FillRectangle(solid, bounds); return; }
        if (dropdown)
        {
            using var fill = new LinearGradientBrush(bounds, Blend(p.Base, p.Accent, .035), Blend(p.Base, Color.Black, p.Dark ? .12 : .025), 90f);
            graphics.FillRectangle(fill, bounds); return;
        }
        using var brush = new LinearGradientBrush(bounds, p.Base, p.Base, 90f);
        brush.InterpolationColors = new ColorBlend
        {
            Colors = [Blend(p.Base, Color.White, p.Dark ? .22 : .60), Blend(p.Base, Color.White, p.Dark ? .09 : .29),
                Blend(p.Base, p.Accent, .055), Blend(p.Base, Color.Black, p.Dark ? .10 : .025), Blend(p.Base, p.Accent, .12)],
            Positions = [0f, .46f, .49f, .52f, 1f]
        };
        graphics.FillRectangle(brush, bounds);
        using var reflection = new Pen(Color.FromArgb(p.Active ? 85 : 40, Color.White));
        graphics.DrawLine(reflection, bounds.Left, bounds.Top, bounds.Right, bounds.Top);
        using var edge = new Pen(p.Border);
        graphics.DrawLine(edge, bounds.Left, bounds.Bottom - 1, bounds.Right, bounds.Bottom - 1);
    }

    [StructLayout(LayoutKind.Sequential)] private struct NativeRect { internal int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { internal int Size; internal NativeRect Monitor, Work; internal uint Flags; }
    [StructLayout(LayoutKind.Sequential)] private struct Margins { internal int Left, Right, Top, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct TrackMouse { internal int Size; internal uint Flags; internal IntPtr Window; internal uint Hover; }
    [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
    [DllImport("dwmapi.dll")] private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);
    [DllImport("dwmapi.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool DwmDefWindowProc(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, out IntPtr result);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr hwnd, int flags);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsZoomed(IntPtr hwnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool TrackMouseEvent(ref TrackMouse track);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] private static extern IntPtr SendMessage(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern IntPtr GetSystemMenu(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool revert);
    [DllImport("user32.dll")] private static extern uint EnableMenuItem(IntPtr menu, int item, uint flags);
    [DllImport("user32.dll")] private static extern uint TrackPopupMenuEx(IntPtr menu, uint flags, int x, int y, IntPtr hwnd, IntPtr parameters);
}
