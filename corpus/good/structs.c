struct Player {
    char name[32];
    int hp;
    float speed;
};

typedef struct {
    int x;
    int y;
} Point;

static int g_count = 0;

void heal(struct Player *p, int amount) {
    p->hp += amount;
    g_count++;
}

int main(void) {
    struct Player hero = {"Ada", 100, 7.5f};
    Point pos = {3, 4};
    heal(&hero, 25);
    printf("%s %d (%d,%d)\n", hero.name, hero.hp, pos.x, pos.y);
    return 0;
}
