# Arch Linux / Omarchy

This recipe repackages the official x86_64 Linux `.deb` as a native pacman
package. It uses system GTK and WebKit libraries and installs the upstream
desktop entry and icons, plus a `gitmo` symlink. It does not compile the app.
The pinned version is 0.11.0; its SHA-256 comes from GitHub's release asset metadata.
The app is closed source, so the package ships a custom `LICENSE` (in this
directory) that is installed under `/usr/share/licenses/gitmoire-bin/`.

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

AUR uses a separate Git repository, not GitHub pull requests.

First submission (once, by a maintainer):

1. Register an AUR account and add an SSH public key to its profile.
2. Add a `# Maintainer: Name <email>` line to `PKGBUILD` and check that the
   `gitmoire-bin` name is still free.
3. Test with `makepkg --cleanbuild` (and `namcap PKGBUILD *.pkg.tar.zst`) on Arch.
4. Push the files to the AUR repo, on the `master` branch:

```sh
git clone ssh://aur@aur.archlinux.org/gitmoire-bin.git
cp PKGBUILD .SRCINFO LICENSE gitmoire-bin/
cd gitmoire-bin && git add PKGBUILD .SRCINFO LICENSE
git commit -m "Initial import" && git push origin master
```

Do not upload binaries or build directories. See the
[AUR submission guidelines](https://wiki.archlinux.org/title/AUR_submission_guidelines).

Later releases are automated by `.github/workflows/publish-aur.yml`. When a stable
release is published it bumps `pkgver`, refreshes the checksum, test-builds the
package in an Arch container, regenerates `.SRCINFO` and pushes to the AUR. It
needs a repository secret `AUR_SSH_PRIVATE_KEY`: a dedicated key whose public half
is added to the AUR account that maintains the package. It can also be run by hand
from the Actions tab with a version. The workflow does not commit back to this
repo, so copy the AUR `PKGBUILD` here occasionally to keep it from drifting.

## Update a release

1. Update `pkgver` to a published release and reset `pkgrel` to `1`.
2. Check the new Debian payload and dependencies. Set `sha256sums` to the new
   asset's SHA-256 from the GitHub release metadata, and verify the download.
3. Run `makepkg --cleanbuild`, inspect the resulting package, and test the
   installed GUI and desktop entry on Arch.
4. Regenerate metadata with `makepkg --printsrcinfo > .SRCINFO`, then commit
   both files to the upstream and AUR repositories.

Keep the `LICENSE` checksum in sync if the file changes. Do not use `SKIP` for the checksum. Increment `pkgrel` when changing packaging
without changing the upstream version.
