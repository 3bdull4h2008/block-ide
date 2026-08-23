void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main(void) {
    int x = 1;
    int y = 2;
    int *p = &x;
    *p = 42;
    swap(&x, &y);
    return x < y ? x : y;
}
