# nix/overlays.nix — Expose pkgs.lailaba-agent for external NixOS configs
{ inputs, ... }:
{
  flake.overlays.default = final: _: {
    lailaba-agent = final.callPackage ./lailaba-agent.nix {
      inherit (inputs) uv2nix pyproject-nix pyproject-build-systems;
      npm-lockfile-fix = inputs.npm-lockfile-fix.packages.${final.stdenv.hostPlatform.system}.default;
      rev = inputs.self.rev or null;
    };
  };
}
