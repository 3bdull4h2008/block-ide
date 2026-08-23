int sum(int arr[], int len) {
    int total = 0;
    for (int i = 0; i < len; i++) {
        total += arr[i];
    }
    return total;
}

int main(void) {
    int nums[5] = {3, 1, 4, 1, 5};
    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};
    return sum(nums, 5) + grid[1][2];
}
