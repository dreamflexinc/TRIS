using System.Security.Cryptography;
using System.Text;

namespace TRIScore.Desktop;

// Profile bytes and encrypted records remain opaque. This compatibility identity
// is private to the local browser partition; it is never shown in the interface.
internal static class ProfileContinuity
{
    private static string Decode(byte[] bytes) => new(bytes.Select(value => (char)(value ^ 0x5B)).ToArray());
    private static string EarlierLabel => Decode([15, 26, 9, 31, 18, 8]);
    private static string EarlierHost => Decode([47, 58, 41, 63, 50, 40]);
    internal static string SecureOrigin => "https://" + EarlierHost + ".invalid/";
    internal static string EarlierStorageKey(string logicalKey) =>
        logicalKey.Replace("triscore", EarlierHost, StringComparison.OrdinalIgnoreCase);
    internal static string CurrentProfile => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TRIScore", "CosmicOrigins", "Profile");
    internal static string EarlierProfile => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), EarlierLabel, "CosmicOrigins", "Profile");
    internal static string EarlierMutexName(string profile) => @"Local\" + EarlierLabel + ".CosmicOrigins." +
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Path.GetFullPath(profile).ToUpperInvariant())))[..24];
    internal static string SanitizeDiagnostics(string text) =>
        text.Replace(EarlierHost, "triscore", StringComparison.OrdinalIgnoreCase);

    internal sealed record CopyResult(bool Migrated, int Files, long Bytes, string Reason);

    // Call before creating WebView2 and while holding this app's destination mutex.
    // The earlier mutex excludes its host; read leases also exclude lingering
    // browser writers after that host has exited. Source files are never changed.
    internal static CopyResult CopyIfNew(string sourceProfile, string destinationProfile, int retryMilliseconds = 6000)
    {
        string source = Path.GetFullPath(sourceProfile).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
            destination = Path.GetFullPath(destinationProfile).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (source.Equals(destination, StringComparison.OrdinalIgnoreCase) ||
            destination.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
            source.StartsWith(destination + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
            Path.GetDirectoryName(destination) == null)
            throw new InvalidOperationException("The profile copy locations are invalid.");
        if (Directory.Exists(destination) && Directory.EnumerateFileSystemEntries(destination).Any())
            return new(false, 0, 0, "already-initialized");
        if (!Directory.Exists(source)) return new(false, 0, 0, "no-earlier-profile");
        if ((File.GetAttributes(source) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidOperationException("The earlier profile uses an unsupported linked folder. Its files were preserved.");

        using var earlierMutex = new Mutex(false, EarlierMutexName(source));
        bool owned;
        try { owned = earlierMutex.WaitOne(0); }
        catch (AbandonedMutexException) { owned = true; }
        if (!owned) throw new InvalidOperationException("Close the earlier app before opening TRIScore. Its saved data is still in use and has been preserved.");

        string parent = Path.GetDirectoryName(destination)!;
        string staging = Path.Combine(parent, ".triscore-profile-copy-" + Guid.NewGuid().ToString("N"));
        List<ReadLease>? leases = null;
        try
        {
            var deadline = Environment.TickCount64 + Math.Clamp(retryMilliseconds, 0, 15000);
            while (true)
            {
                try
                {
                    var files = Snapshot(source);
                    leases = [];
                    foreach (var file in files)
                        leases.Add(new(file, new FileStream(file.FullPath, FileMode.Open, FileAccess.Read, FileShare.Read)));
                    var check = Snapshot(source);
                    if (!files.Select(f => f.RelativePath).SequenceEqual(check.Select(f => f.RelativePath), StringComparer.OrdinalIgnoreCase))
                        throw new IOException("The profile is still changing.");
                    break;
                }
                catch (IOException)
                {
                    DisposeLeases(leases); leases = null;
                    if (Environment.TickCount64 >= deadline)
                        throw new InvalidOperationException("The earlier browser is still closing. Wait a moment and reopen TRIScore. Its original files were preserved.");
                    Thread.Sleep(120);
                }
            }

            Directory.CreateDirectory(parent);
            Directory.CreateDirectory(staging);
            long bytes = 0;
            foreach (var lease in leases!)
            {
                string target = Path.Combine(staging, lease.File.RelativePath);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                using (var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    lease.Stream.Position = 0;
                    lease.Stream.CopyTo(output);
                    output.Flush(true);
                    bytes += output.Length;
                }
                File.SetLastWriteTimeUtc(target, lease.File.Modified);
            }
            // The destination is published only after every retained file copied.
            // Never replace a profile populated by another launch or by the owner.
            if (Directory.Exists(destination))
            {
                if (Directory.EnumerateFileSystemEntries(destination).Any())
                    return new(false, 0, 0, "destination-created-during-copy");
                Directory.Delete(destination, false); // verified empty, never recursive.
            }
            Directory.Move(staging, destination);
            return new(true, leases.Count, bytes, "copied");
        }
        catch (UnauthorizedAccessException)
        {
            throw new InvalidOperationException("TRIScore could not copy the earlier profile. Its original files were preserved. Check that the profile folders are accessible.");
        }
        catch (IOException)
        {
            throw new InvalidOperationException("TRIScore could not complete the profile copy. Its original files were preserved. Close the earlier app and try again.");
        }
        finally
        {
            DisposeLeases(leases);
            // Only our uniquely named sibling staging folder is eligible for cleanup.
            if (Directory.Exists(staging) &&
                Path.GetDirectoryName(Path.GetFullPath(staging))!.Equals(parent, StringComparison.OrdinalIgnoreCase) &&
                Path.GetFileName(staging).StartsWith(".triscore-profile-copy-", StringComparison.Ordinal))
            {
                try { Directory.Delete(staging, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
            }
            earlierMutex.ReleaseMutex();
        }
    }

    private sealed record CopyFile(string FullPath, string RelativePath, DateTime Modified);
    private sealed record ReadLease(CopyFile File, FileStream Stream);
    private static void DisposeLeases(List<ReadLease>? leases)
    { if (leases != null) foreach (var lease in leases) lease.Stream.Dispose(); }
    private static readonly HashSet<string> CacheFolders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cache", "Code Cache", "GPUCache", "ShaderCache", "GrShaderCache", "GPUPersistentCache",
        "DawnGraphiteCache", "DawnWebGPUCache", "Crashpad", "BrowserMetrics", "component_crx_cache",
        "optimization_guide_hint_cache_store"
    };
    private static List<CopyFile> Snapshot(string source)
    {
        var result = new List<CopyFile>();
        void Visit(string directory)
        {
            foreach (string entry in Directory.EnumerateFileSystemEntries(directory).Order(StringComparer.OrdinalIgnoreCase))
            {
                var attributes = File.GetAttributes(entry);
                if ((attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidOperationException("The earlier profile contains an unsupported linked entry. Its original files were preserved.");
                if ((attributes & FileAttributes.Directory) != 0)
                {
                    if (!CacheFolders.Contains(Path.GetFileName(entry))) Visit(entry);
                }
                else result.Add(new(entry, Path.GetRelativePath(source, entry), File.GetLastWriteTimeUtc(entry)));
            }
        }
        Visit(source);
        return result;
    }

    internal static object RunSelfTests(string root)
    {
        var checks = new List<string>();
        void Check(bool condition, string label) { if (!condition) throw new InvalidOperationException(label); checks.Add(label); }
        string source = Path.Combine(root, "synthetic-earlier"), target = Path.Combine(root, "synthetic-current");
        Directory.CreateDirectory(Path.Combine(source, "EBWebView", "Default", "IndexedDB"));
        Directory.CreateDirectory(Path.Combine(source, "EBWebView", "Default", "Local Storage"));
        Directory.CreateDirectory(Path.Combine(source, "EBWebView", "Default", "Cache"));
        File.WriteAllText(Path.Combine(source, "EBWebView", "Local State"), "SYNTHETIC_LOCAL_STATE");
        File.WriteAllText(Path.Combine(source, "EBWebView", "Default", "IndexedDB", "test.ldb"), "OPAQUE_SYNTHETIC_VAULT");
        File.WriteAllText(Path.Combine(source, "EBWebView", "Default", "Local Storage", "test.log"), "SYNTHETIC_PALETTE");
        File.WriteAllText(Path.Combine(source, "EBWebView", "Default", "Cache", "discard.bin"), "REGENERABLE");
        var hashes = Directory.GetFiles(source, "*", SearchOption.AllDirectories)
            .ToDictionary(p => p, p => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(p))));

        var copied = CopyIfNew(source, target, 0);
        Check(copied.Migrated && copied.Files == 3, "Closed profile copies persistent files and excludes regenerable cache");
        Check(File.ReadAllText(Path.Combine(target, "EBWebView", "Default", "IndexedDB", "test.ldb")) == "OPAQUE_SYNTHETIC_VAULT", "IndexedDB payload copies byte-for-byte");
        Check(File.ReadAllText(Path.Combine(target, "EBWebView", "Default", "Local Storage", "test.log")) == "SYNTHETIC_PALETTE", "Local storage payload copies byte-for-byte");
        Check(hashes.All(pair => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(pair.Key))) == pair.Value), "Original profile files remain byte-identical");
        File.WriteAllText(Path.Combine(target, "owner-state"), "KEEP");
        Check(!CopyIfNew(source, target, 0).Migrated && File.ReadAllText(Path.Combine(target, "owner-state")) == "KEEP", "Existing destination is never overwritten");

        using (var held = new FileStream(Path.Combine(source, "EBWebView", "Local State"), FileMode.Open, FileAccess.ReadWrite, FileShare.None))
        {
            bool blocked = false;
            try { CopyIfNew(source, Path.Combine(root, "locked-file-target"), 0); }
            catch (InvalidOperationException) { blocked = true; }
            Check(blocked && !Directory.Exists(Path.Combine(root, "locked-file-target")), "Active browser file blocks copy without publishing a partial profile");
        }
        using var ready = new ManualResetEventSlim();
        using var release = new ManualResetEventSlim();
        var holder = new Thread(() =>
        {
            using var mutex = new Mutex(false, EarlierMutexName(source));
            mutex.WaitOne(); ready.Set(); release.Wait(); mutex.ReleaseMutex();
        }) { IsBackground = true };
        holder.Start(); ready.Wait();
        try
        {
            bool blocked = false;
            try { CopyIfNew(source, Path.Combine(root, "locked-instance-target"), 0); }
            catch (InvalidOperationException) { blocked = true; }
            Check(blocked && !Directory.Exists(Path.Combine(root, "locked-instance-target")), "Earlier app instance mutex blocks profile copying");
        }
        finally { release.Set(); holder.Join(); }
        Check(!Directory.EnumerateDirectories(root, ".triscore-profile-copy-*", SearchOption.AllDirectories).Any(), "No partial migration staging remains");
        Check(Uri.TryCreate(SecureOrigin, UriKind.Absolute, out var origin) && origin.Scheme == "https" && origin.IsDefaultPort, "Opaque compatibility partition remains a secure local origin");
        return new { checks, passed = checks.Count };
    }
}
