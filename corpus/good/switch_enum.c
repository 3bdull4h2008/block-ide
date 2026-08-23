enum Color { RED,
             GREEN,
             BLUE };

const char *name(enum Color c) {
    switch (c) {
        case RED:
            return "red";
        case GREEN:
            return "green";
        case BLUE:
            return "blue";
        default:
            return "?";
    }
}

int main(void) {
    printf("%s\n", name(GREEN));
    return 0;
}
