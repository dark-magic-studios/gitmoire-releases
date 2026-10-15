# Arch Linux / Omarchy

This recipe repackages the official x86_64 Linux `.deb` as a native pacman
package. It uses system GTK and WebKit libraries and installs the upstream
desktop entry and icons, plus a `gitmo` symlink. It does not compile the app.
The pinned version is the latest published stable release at preparation time,
0.9.2; its SHA-256 comes from GitHub's release asset metadata.

## Build and install

Install Arch's `base-devel` group, then run from this directory:

```sh
makepkg -si
```

Launch `gitmoire` from the application menu or terminal. Remove with
`sudo pacman -Rns gitmoire-bin`.

This is a local package until a maintainer publishes it to the AUR. Normal
repository upgrades will not update this local package. Updates should use
pacman and an updated recipe; the upstream in-app updater is not validated for
this repackaged installation.

## Publish to AUR

AUR uses a separate Git repository, not GitHub pull requests. A maintainer must
register an AUR account and SSH key, check that the package name is still
available, and add their `# Maintainer:` line to `PKGBUILD` before publishing.
Copy `PKGBUILD` and `.SRCINFO` into the root of the AUR package repository and
commit them on its `master` branch. Do not upload binaries or build directories.
See the [AUR submission guidelines](https://wiki.archlinux.org/title/AUR_submission_guidelines).

Before publishing, upstream should supply the app's MIT license text, including
its copyright notices, as a public release asset so the package can install it
under `/usr/share/licenses/gitmoire-bin/`. The public website identifies the app
as MIT, but the 0.9.2 Debian payload contains no license file and the app's source
is private. This recipe does not invent those notices. Choose a license for the
packaging sources as part of the AUR submission as well.

## Update a release

1. Update `pkgver` to a published release and reset `pkgrel` to `1`.
2. Check the new Debian payload and dependencies. Set `sha256sums` to the new
   asset's SHA-256 from the GitHub release metadata, and verify the download.
3. Run `makepkg --cleanbuild`, inspect the resulting package, and test the
   installed GUI and desktop entry on Arch.
4. Regenerate metadata with `makepkg --printsrcinfo > .SRCINFO`, then commit
   both files to the upstream and AUR repositories.

Do not use `SKIP` for the checksum. Increment `pkgrel` when changing packaging
without changing the upstream version.
