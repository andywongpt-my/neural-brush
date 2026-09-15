export interface AppSnapshot {
  splitRatio: number;
  imageName: string | null;
}

export class AppState {
  private splitRatio = 0.58;
  private imageName: string | null = null;

  setSplitRatio(value: number): void {
    this.splitRatio = Math.min(0.75, Math.max(0.35, value));
  }

  setImageName(name: string | null): void {
    this.imageName = name;
  }

  getSnapshot(): AppSnapshot {
    return {
      splitRatio: this.splitRatio,
      imageName: this.imageName,
    };
  }
}
