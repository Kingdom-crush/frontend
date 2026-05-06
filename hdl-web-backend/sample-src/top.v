module top(
    input wire clk,
    input wire rst_n,
    input wire [7:0] din,
    output reg [7:0] dout
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            dout <= 8'h00;
        end else begin
            dout <= din;
        end
    end
endmodule
